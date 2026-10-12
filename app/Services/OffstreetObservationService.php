<?php

namespace App\Services;

use App\Events\DatasetDataChanged;
use App\Events\OffstreetObservationsApplied;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\ParkingOffstreet;
use App\Support\OffstreetObservations;
use App\Support\OffstreetSnapshot;
use Aws\Exception\AwsException;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Applies live occupancy observations to catalog facilities without review (#1221).
 * Observations never create or remove facilities; only the newest measurement per facility is kept.
 */
class OffstreetObservationService
{
    public function __construct(private DatasetDeliveryStorage $storage, private OffstreetObservations $format, private OffstreetSnapshot $snapshot, private OffstreetIdentityService $identity) {}

    /**
     * Reads only the newest unprocessed delivery per approved offstreet source: older ones are superseded,
     * so an outage never triggers catch-up of old measurements.
     *
     * @return array<string, array{applied: int, unknown: int}|null> Result per source code; null when nothing new arrived
     */
    public function ingest(): array
    {
        if (! config('dataset-deliveries.enabled')) {
            return [];
        }
        $results = [];
        $sources = DatasetSource::where('target_type', 'offstreet')->where('approval_state', 'approved')->orderBy('code')->get();
        foreach ($sources as $source) {
            $results[$source->code] = $this->ingestSource($source);
        }

        return $results;
    }

    /** @return array{applied: int, unknown: int}|null */
    private function ingestSource(DatasetSource $source): ?array
    {
        try {
            $newest = null;
            foreach ($this->storage->observations($source->code, $source->last_observation_key) as $object) {
                $newest = $object;
            }
            if ($newest === null) {
                return null;
            }
            $json = $this->storage->read($newest['key'], $newest['etag']);
        } catch (AwsException|RuntimeException $exception) {
            // Transient storage failure: keep the position so the next run tries again.
            Log::warning('Offstreet observations could not be read.', ['source' => $source->code, 'exception' => $exception::class]);

            return null;
        } catch (ValidationException $exception) {
            return $this->skip($source, $newest['key'], $exception);
        }

        try {
            $delivery = $this->format->decode($json);
            if ($delivery['dataset'] !== $source->code || $delivery['selection'] !== $source->selection) {
                throw ValidationException::withMessages(['dataset' => 'Dataset of selectie hoort niet bij deze bron.']);
            }
            if ($delivery['identity_records'] !== null) {
                $delivery['identity_records'] = $this->snapshot->validate([
                    'dataset' => $delivery['dataset'], 'selection' => $delivery['selection'], 'records' => $delivery['identity_records'],
                ], $source);
                $claims = array_column(array_column($delivery['identity_records'], 'source'), 'external_id');
                $observed = array_column($delivery['records'], 'external_id');
                sort($claims);
                sort($observed);
                if ($claims !== $observed) {
                    throw ValidationException::withMessages(['identity_records' => 'De locatiekenmerken horen niet bij dezelfde volledige meting.']);
                }
            }
        } catch (ValidationException $exception) {
            return $this->skip($source, $newest['key'], $exception);
        }

        return DB::transaction(function () use ($source, $delivery, $newest): array {
            $source = DatasetSource::whereKey($source->id)->lockForUpdate()->firstOrFail();
            $catalog = null;
            if ($delivery['catalog_delivery_id'] !== null) {
                $catalog = DatasetImport::where('dataset_source_id', $source->id)
                    ->where('delivery_id', $delivery['catalog_delivery_id'])->where('state', 'published')->first();
                if ($catalog === null || $catalog->retrieved_at->gt($delivery['fetched_at'])) {
                    // Keep the cursor: catalog review may still be pending; retry the newest observation later.
                    return ['applied' => 0, 'unknown' => count($delivery['records'])];
                }
            }
            if (! $source->isApproved()) {
                return ['applied' => 0, 'unknown' => count($delivery['records'])];
            }
            $context = [];
            $bindings = $catalog === null ? [] : collect($catalog->identity_resolution ?? [])->pluck('facility_id', 'external_id')->all();
            $query = ParkingOffstreet::where('dataset_source_id', $source->id);
            if ($delivery['identity_records'] !== null) {
                $spaces = $query->lockForUpdate()->get()->keyBy('id');
                $candidate = new DatasetImport(['dataset_source_id' => $source->id, 'records' => $delivery['identity_records']]);
                $candidate->state = 'pending';
                foreach ($this->identity->resolve($candidate, $spaces, false) as $resolution) {
                    if (in_array($resolution['method'], ['source_id', 'name_type_location'], true)) {
                        $bindings[$resolution['external_id']] = $resolution['facility_id'];
                    }
                }
                $context = collect($delivery['identity_records'])->pluck('source', 'source.external_id')->all();
            } else {
                $spaces = $delivery['catalog_delivery_id'] === null
                    ? ($source->requires_identity_context ? collect() : $query->whereIn('external_id', array_column($delivery['records'], 'external_id'))->lockForUpdate()->get()->keyBy('external_id'))
                    : $query->whereIn('id', array_values($bindings))->lockForUpdate()->get()->keyBy('id');
            }
            $applied = 0;
            $unknown = 0;
            foreach ($delivery['records'] as $record) {
                $space = $spaces->get($delivery['catalog_delivery_id'] === null && $delivery['identity_records'] === null ? $record['external_id'] : ($bindings[$record['external_id']] ?? null));
                if ($space === null) {
                    $unknown++;
                }
                if ($space && $this->isNewer($record, $delivery['fetched_at'], $space)) {
                    $space->forceFill([
                        'api_state' => $record['source_state'],
                        'occupancy_status' => $record['status'],
                        'capacity' => $record['capacity'],
                        'free_space' => $record['available'],
                        'observed_at' => $record['observed_at'],
                        'observation_fetched_at' => $delivery['fetched_at'],
                        'observation_identity' => ['catalog_delivery_id' => $delivery['catalog_delivery_id'], 'source_record' => $context[$record['external_id']] ?? null],
                    ])->save();
                    $applied++;
                }
            }
            $source->forceFill(['last_observation_key' => $newest['key']])->save();
            if ($applied > 0) {
                DatasetDataChanged::dispatch('observations', 'offstreet');
                OffstreetObservationsApplied::dispatch();
            }

            // Unknown facilities wait for a catalog link; they are counted, never created.
            return ['applied' => $applied, 'unknown' => $unknown];
        });
    }

    /**
     * A measurement replaces the stored one only when it is newer. Equal times keep the stored values, so a duplicate
     * delivery changes nothing; a measurement without source time never replaces one with a known time.
     *
     * @param  array{observed_at: ?CarbonImmutable}  $record
     */
    private function isNewer(array $record, CarbonImmutable $fetchedAt, ParkingOffstreet $space): bool
    {
        if ($record['observed_at'] !== null) {
            return $space->observed_at === null || $record['observed_at']->gt($space->observed_at);
        }

        return $space->observed_at === null && ($space->observation_fetched_at === null || $fetchedAt->gt($space->observation_fetched_at));
    }

    /** An invalid delivery is logged and passed; retrying the same object would fail forever and block newer ones. */
    private function skip(DatasetSource $source, string $key, ValidationException $exception): null
    {
        Log::warning('Offstreet observations rejected.', ['source' => $source->code, 'key' => $key, 'errors' => $exception->errors()]);
        $source->forceFill(['last_observation_key' => $key])->save();

        return null;
    }
}
