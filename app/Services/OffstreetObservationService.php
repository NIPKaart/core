<?php

namespace App\Services;

use App\Events\DatasetDataChanged;
use App\Events\OffstreetObservationsApplied;
use App\Models\DatasetSource;
use App\Models\ParkingOffstreet;
use App\Support\OffstreetObservations;
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
    public function __construct(private DatasetDeliveryStorage $storage, private OffstreetObservations $format) {}

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
        } catch (ValidationException $exception) {
            return $this->skip($source, $newest['key'], $exception);
        }

        return DB::transaction(function () use ($source, $delivery, $newest): array {
            $spaces = ParkingOffstreet::where('dataset_source_id', $source->id)
                ->whereIn('external_id', array_column($delivery['records'], 'external_id'))
                ->get()->keyBy('external_id');
            $applied = 0;
            foreach ($delivery['records'] as $record) {
                $space = $spaces->get($record['external_id']);
                if ($space && $this->isNewer($record, $delivery['fetched_at'], $space)) {
                    $space->forceFill([
                        'api_state' => $record['source_state'],
                        'occupancy_status' => $record['status'],
                        'capacity' => $record['capacity'],
                        'free_space' => $record['available'],
                        'observed_at' => $record['observed_at'],
                        'observation_fetched_at' => $delivery['fetched_at'],
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
            return ['applied' => $applied, 'unknown' => count($delivery['records']) - $spaces->count()];
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
