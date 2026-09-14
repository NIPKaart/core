<?php

namespace App\Services;

use App\Models\DatasetSource;
use App\Models\MunicipalImport;
use App\Models\ParkingMunicipal;
use App\Models\User;
use App\Support\MunicipalSnapshot;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MunicipalImportService
{
    public function __construct(private MunicipalSnapshot $snapshot) {}

    public function intake(string $json, User $actor): MunicipalImport
    {
        Gate::forUser($actor)->authorize('create', MunicipalImport::class);

        return $this->stage($json, $actor, $this->snapshot->decode($json));
    }

    public function intakeFromStorage(string $json, string $dataset, string $deliveryId): MunicipalImport
    {
        $data = $this->snapshot->decode($json);
        if ($data['dataset'] !== $dataset || $data['delivery_id'] !== $deliveryId) {
            throw ValidationException::withMessages(['file' => 'Object identity does not match its contents.']);
        }

        return $this->stage($json, null, $data);
    }

    /** @param array<string, mixed> $data */
    private function stage(string $json, ?User $actor, array $data): MunicipalImport
    {
        $source = DatasetSource::where('code', $data['dataset'])->first();
        if (! $source) {
            throw ValidationException::withMessages(['dataset' => 'Deze dataset is niet geregistreerd.']);
        }
        $fingerprint = hash('sha256', $json);
        $existing = MunicipalImport::where('dataset_source_id', $source->id)->where('delivery_id', $data['delivery_id'])->first();
        if ($existing) {
            return $this->existingDelivery($existing, $fingerprint);
        }
        $configuration = $source->configuration();
        $records = $this->snapshot->validate($data, $source);

        return DB::transaction(function () use ($source, $configuration, $records, $data, $fingerprint, $actor) {
            $source = DatasetSource::whereKey($source->id)->lockForUpdate()->firstOrFail();
            $existing = MunicipalImport::where('dataset_source_id', $source->id)->where('delivery_id', $data['delivery_id'])->first();
            if ($existing) {
                return $this->existingDelivery($existing, $fingerprint);
            }
            if (MunicipalSnapshot::fingerprint($source->configuration()) !== MunicipalSnapshot::fingerprint($configuration)) {
                throw ValidationException::withMessages(['dataset' => 'De datasetconfiguratie is gewijzigd. Lees het bestand opnieuw in.']);
            }

            return MunicipalImport::create([
                'dataset_source_id' => $source->id, 'delivery_id' => $data['delivery_id'],
                'fingerprint' => $fingerprint, 'retrieved_at' => $data['retrieved_at'],
                'dataset_config' => $configuration, 'records' => $records, 'submitted_by' => $actor?->id,
            ])->refresh();
        });
    }

    private function existingDelivery(MunicipalImport $import, string $fingerprint): MunicipalImport
    {
        if ($import->fingerprint !== $fingerprint) {
            throw ValidationException::withMessages(['delivery_id' => 'Deze leverings-ID is al gebruikt voor andere inhoud.']);
        }

        return $import;
    }

    /** @return array<string, mixed> */
    public function review(MunicipalImport $import, bool $lock = false): array
    {
        $source = $import->datasetSource;
        $query = ParkingMunicipal::where('dataset_source_id', $source->id)->orderBy('id');
        if ($lock) {
            $query->lockForUpdate();
        }
        $existing = $query->get()->keyBy('external_id');
        $rows = [];
        $counts = ['new' => 0, 'changed' => 0, 'unchanged' => 0, 'missing' => 0, 'conflict' => 0];
        foreach ($import->records as $record) {
            $id = $record['source']['external_id'];
            $space = $existing->get($id);
            $fields = [];
            $conflicts = [];
            if ($space) {
                foreach (array_unique([...array_keys($record['source']), ...array_keys($space->source_record ?? [])]) as $field) {
                    $value = $record['source'][$field] ?? null;
                    if (MunicipalSnapshot::fingerprint($value) !== MunicipalSnapshot::fingerprint($space->source_record[$field] ?? null)) {
                        $fields[] = $field;
                    }
                }
                foreach ($record['values'] as $field => $value) {
                    if ($space->last_imported_values === null || (MunicipalSnapshot::fingerprint($this->value($space, $field)) !== MunicipalSnapshot::fingerprint($space->last_imported_values[$field]) && MunicipalSnapshot::fingerprint($value) !== MunicipalSnapshot::fingerprint($space->last_imported_values[$field]) && MunicipalSnapshot::fingerprint($value) !== MunicipalSnapshot::fingerprint($this->value($space, $field)))) {
                        $conflicts[] = $field;
                    }
                }
            }
            if ($space && MunicipalSnapshot::fingerprint($record['geometry_derivation'] ?? null) !== MunicipalSnapshot::fingerprint($space->geometry_derivation)) {
                $fields[] = 'geometry_derivation';
            }
            $status = ! $space ? 'new' : ($conflicts ? 'conflict' : ($fields ? 'changed' : 'unchanged'));
            $counts[$status]++;
            $rows[] = [
                'external_id' => $id, 'status' => $status, 'fields' => $fields, 'conflicts' => $conflicts,
                'before' => $space?->source_record, 'after' => $record['source'],
                'geometry_derivation' => $record['geometry_derivation'] ?? null,
                'previous_geometry_derivation' => $space?->geometry_derivation,
                'point' => ['latitude' => $record['values']['latitude'], 'longitude' => $record['values']['longitude']],
                'current' => $space?->only(['id', 'number', 'street', 'orientation', 'latitude', 'longitude', 'visibility']),
            ];
            $existing->forget($id);
        }
        foreach ($existing as $space) {
            $counts['missing']++;
            $rows[] = ['external_id' => $space->external_id, 'status' => 'missing', 'fields' => [], 'conflicts' => [], 'before' => $space->source_record, 'after' => null, 'current' => $space->only(['id', 'visibility'])];
        }
        $rows = collect($rows)->sortByDesc(fn ($row) => ! empty($row['geometry_derivation']))->values()->all();
        $derivations = count(array_filter($rows, fn ($row) => ! empty($row['geometry_derivation'])));
        $blockers = [];
        if (! $source->publication_enabled) {
            $blockers[] = 'Publicatie is nog niet ingeschakeld voor deze dataset. Bevestig eerst de bronvoorwaarden.';
        }
        if (MunicipalSnapshot::fingerprint($source->configuration()) !== MunicipalSnapshot::fingerprint($import->dataset_config)) {
            $blockers[] = 'De datasetconfiguratie is gewijzigd sinds ontvangst. Lever een nieuw bestand aan.';
        }
        if ($source->last_published_retrieved_at && $import->retrieved_at->lessThanOrEqualTo($source->last_published_retrieved_at)) {
            $blockers[] = 'Deze levering is niet nieuwer dan de laatst gepubliceerde levering.';
        }
        if ($counts['conflict'] > 0) {
            $blockers[] = 'Bronwijzigingen conflicteren met handmatig aangepaste velden. Publicatie is geblokkeerd.';
        }

        return ['rows' => $rows, 'counts' => $counts, 'derivations' => $derivations, 'blockers' => $blockers, 'token' => MunicipalSnapshot::fingerprint([$source->configuration(), $source->last_published_retrieved_at, $rows])];
    }

    public function decide(MunicipalImport $import, User $actor, string $decision, string $reason, string $reviewToken, bool $geometryReviewed = false): void
    {
        Gate::forUser($actor)->authorize('update', $import);
        DB::transaction(function () use ($import, $actor, $decision, $reason, $reviewToken, $geometryReviewed) {
            $source = DatasetSource::whereKey($import->dataset_source_id)->lockForUpdate()->firstOrFail();
            $import = MunicipalImport::whereKey($import->id)->lockForUpdate()->firstOrFail();
            $import->setRelation('datasetSource', $source);
            if ($import->state !== 'pending') {
                throw ValidationException::withMessages(['decision' => 'Deze levering is al beoordeeld.']);
            }
            if ($decision === 'publish') {
                $review = $this->review($import, true);
                if ($review['blockers'] || ! hash_equals($review['token'], $reviewToken)) {
                    throw ValidationException::withMessages(['decision' => $review['blockers'] ?: ['De gegevens zijn veranderd. Bekijk de verschillen opnieuw.']]);
                }
                if ($review['derivations'] > 0 && ! $geometryReviewed) {
                    throw ValidationException::withMessages(['geometry_reviewed' => 'Bevestig dat je de afgeleide geometrieën hebt beoordeeld.']);
                }
                $this->publish($import, $source);
                $source->last_published_retrieved_at = $import->retrieved_at;
                $source->save();
            } elseif ($decision !== 'reject') {
                throw ValidationException::withMessages(['decision' => 'Ongeldige beslissing.']);
            }
            $import->forceFill(['state' => $decision === 'publish' ? 'published' : 'rejected', 'reviewed_by' => $actor->id, 'review_reason' => $reason, 'reviewed_at' => now()])->save();
        });
    }

    private function publish(MunicipalImport $import, DatasetSource $source): void
    {
        $municipality = $source->municipality;
        $existing = ParkingMunicipal::where('dataset_source_id', $source->id)->get()->keyBy('external_id');
        $updates = [];
        $before = [];
        foreach ($import->records as $record) {
            $externalId = $record['source']['external_id'];
            $space = $existing->get($externalId);
            if ($space && MunicipalSnapshot::fingerprint($space->source_record) === MunicipalSnapshot::fingerprint($record['source']) && MunicipalSnapshot::fingerprint($space->geometry_derivation) === MunicipalSnapshot::fingerprint($record['geometry_derivation'] ?? null)) {
                continue;
            }
            $values = $record['values'];
            if ($space) {
                foreach ($values as $field => $value) {
                    if ($space->last_imported_values === null || MunicipalSnapshot::fingerprint($this->value($space, $field)) !== MunicipalSnapshot::fingerprint($space->last_imported_values[$field])) {
                        $values[$field] = $this->value($space, $field);
                    }
                }
            }
            $id = $space?->id ?? (string) Str::uuid();
            $before[$id] = $space?->getAttributes();
            unset($before[$id]['location']);
            $updates[] = [
                'id' => $id, 'dataset_source_id' => $source->id, 'external_id' => $externalId,
                'country_id' => $municipality->country_id, 'province_id' => $municipality->province_id, 'municipality_id' => $municipality->id,
                ...$values, 'visibility' => $space?->visibility ?? true,
                'source_record' => json_encode($record['source'], JSON_THROW_ON_ERROR),
                'geometry_derivation' => isset($record['geometry_derivation']) ? json_encode($record['geometry_derivation'], JSON_THROW_ON_ERROR) : null,
                'last_imported_values' => json_encode($record['values'], JSON_THROW_ON_ERROR),
                'last_checked_at' => now(), 'created_at' => $space?->created_at ?? now(), 'updated_at' => now(),
            ];
        }
        foreach (array_chunk($updates, 100) as $chunk) {
            ParkingMunicipal::upsert($chunk, ['id'], ['street', 'number', 'orientation', 'latitude', 'longitude', 'source_record', 'geometry_derivation', 'last_imported_values', 'last_checked_at', 'updated_at']);
        }
        ParkingMunicipal::where('dataset_source_id', $source->id)
            ->whereIn('external_id', array_column(array_column($import->records, 'source'), 'external_id'))
            ->toBase()->update(['last_checked_at' => now()]);
        $import->before_values = $before;
    }

    private function value(ParkingMunicipal $space, string $field): mixed
    {
        $value = $space->getAttribute($field);

        return $value instanceof \BackedEnum ? $value->value : $value;
    }
}
