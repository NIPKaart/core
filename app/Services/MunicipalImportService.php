<?php

namespace App\Services;

use App\Contracts\DatasetImporter;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\ParkingMunicipal;
use App\Models\User;
use App\Support\MunicipalSnapshot;
use App\Traits\StagesDatasetImports;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MunicipalImportService implements DatasetImporter
{
    use StagesDatasetImports;

    public function __construct(private MunicipalSnapshot $snapshot, private MunicipalIdentityService $identity, private DatasetPublicationPolicy $publicationPolicy) {}

    /** @return array<string, mixed> */
    protected function decodeSnapshot(string $json): array
    {
        return $this->snapshot->decode($json);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array<string, mixed>>
     */
    protected function validateRecords(array $data, DatasetSource $source): array
    {
        return $this->snapshot->validate($data, $source);
    }

    /** @return array<string, mixed> */
    public function review(DatasetImport $import, bool $lock = false): array
    {
        $source = $import->datasetSource;
        $query = ParkingMunicipal::where('dataset_source_id', $source->id)->orderBy('id');
        if ($lock) {
            $query->lockForUpdate();
        }
        $existing = $query->get()->keyBy('id');
        $identities = $this->identity->resolve($import, $existing);
        $rows = [];
        $counts = ['new' => 0, 'changed' => 0, 'unchanged' => 0, 'missing' => 0, 'conflict' => 0];
        foreach ($import->records as $index => $record) {
            $id = $record['source']['external_id'];
            $identity = $identities[$index];
            $space = $existing->get($identity['facility_id']);
            $before = $space?->source_record;
            $previousValues = $space?->last_imported_values;
            $previousDerivation = $space?->geometry_derivation;
            $fields = [];
            $conflicts = [];
            if ($space) {
                foreach (array_unique([...array_keys($record['source']), ...array_keys($before ?? [])]) as $field) {
                    $value = $record['source'][$field] ?? null;
                    $previous = $before[$field] ?? null;
                    if ($field === 'source_attributes') {
                        $value = $this->comparableSourceAttributes($value ?? []);
                        $previous = $this->comparableSourceAttributes($previous ?? []);
                    }
                    if (MunicipalSnapshot::fingerprint($value) !== MunicipalSnapshot::fingerprint($previous)) {
                        $fields[] = $field;
                    }
                }
                foreach ($record['values'] as $field => $value) {
                    if ($previousValues === null || (MunicipalSnapshot::fingerprint($this->value($space, $field)) !== MunicipalSnapshot::fingerprint($previousValues[$field]) && MunicipalSnapshot::fingerprint($value) !== MunicipalSnapshot::fingerprint($previousValues[$field]) && MunicipalSnapshot::fingerprint($value) !== MunicipalSnapshot::fingerprint($this->value($space, $field)))) {
                        $conflicts[] = $field;
                    }
                }
            }
            if ($space && MunicipalSnapshot::fingerprint($record['geometry_derivation'] ?? null) !== MunicipalSnapshot::fingerprint($previousDerivation)) {
                $fields[] = 'geometry_derivation';
            }
            $status = $identity['method'] === 'review' ? 'conflict' : (! $space ? 'new' : ($conflicts ? 'conflict' : ($fields ? 'changed' : 'unchanged')));
            $counts[$status]++;
            $rows[] = [
                'external_id' => $id, 'identity' => $identity, 'status' => $status, 'fields' => $fields, 'conflicts' => $conflicts,
                'before' => $before, 'after' => $record['source'],
                'geometry_derivation' => $record['geometry_derivation'] ?? null,
                'geometry_review_required' => ! empty($record['geometry_derivation']) && (! $space
                    || MunicipalSnapshot::fingerprint($record['source']['geometry']) !== MunicipalSnapshot::fingerprint($before['geometry'] ?? null)
                    || MunicipalSnapshot::fingerprint($record['geometry_derivation']) !== MunicipalSnapshot::fingerprint($previousDerivation)),
                'previous_geometry_derivation' => $previousDerivation,
                'point' => ['latitude' => $record['values']['latitude'], 'longitude' => $record['values']['longitude']],
                'current' => $space?->only(['id', 'number', 'street', 'orientation', 'latitude', 'longitude', 'visibility']),
            ];
            $existing->forget($identity['facility_id']);
        }
        foreach ($existing as $space) {
            $counts['missing']++;
            $rows[] = ['external_id' => $space->source_record['external_id'] ?? $space->external_id, 'status' => 'missing', 'fields' => [], 'conflicts' => [], 'before' => $space->source_record, 'after' => null, 'point' => ['latitude' => $space->latitude, 'longitude' => $space->longitude], 'current' => $space->only(['id', 'visibility'])];
        }
        $rows = collect($rows)->sortByDesc(fn ($row) => $row['geometry_review_required'] ?? false)->values()->all();
        $derivations = count(array_filter($rows, fn ($row) => $row['geometry_review_required'] ?? false));
        $blockers = [];
        if (MunicipalSnapshot::fingerprint($source->configuration()) !== MunicipalSnapshot::fingerprint(Arr::except($import->dataset_config, ['publication_enabled']))) {
            $blockers[] = 'De datasetconfiguratie is gewijzigd sinds ontvangst. Lever een nieuw bestand aan.';
        }
        if ($source->last_published_retrieved_at && $import->retrieved_at->lessThanOrEqualTo($source->last_published_retrieved_at)) {
            $blockers[] = 'Deze levering is niet nieuwer dan de laatst gepubliceerde levering.';
        }
        if (collect($identities)->contains('method', 'review')) {
            $blockers[] = 'Beoordeel eerst de onzekere locatiekoppelingen.';
        }
        if (collect($rows)->contains(fn (array $row): bool => $row['conflicts'] !== [])) {
            $blockers[] = 'Bronwijzigingen conflicteren met handmatig aangepaste velden. Publicatie is geblokkeerd.';
        }

        return ['identities' => $identities, 'rows' => $rows, 'counts' => $counts, 'derivations' => $derivations, 'blockers' => $blockers, 'token' => MunicipalSnapshot::fingerprint([$source->configuration(), $source->last_published_retrieved_at, $rows, $import->identity_decisions])];
    }

    /** Records an explicit identity decision without changing published municipal spaces. */
    public function resolveIdentity(DatasetImport $import, User $actor, string $externalId, ?string $facilityId, string $reason, string $token): void
    {
        Gate::forUser($actor)->authorize('update', $import);
        DB::transaction(function () use ($import, $actor, $externalId, $facilityId, $reason, $token): void {
            $source = DatasetSource::whereKey($import->dataset_source_id)->lockForUpdate()->firstOrFail();
            $import = DatasetImport::whereKey($import->id)->lockForUpdate()->firstOrFail();
            $import->setRelation('datasetSource', $source);
            $review = $this->review($import, true);
            if ($import->state !== 'pending' || $import->isSuperseded() || ! hash_equals($review['token'], $token)) {
                throw ValidationException::withMessages(['identity' => 'De levering is veranderd of al beoordeeld. Bekijk de verschillen opnieuw.']);
            }
            $row = collect($review['identities'])->firstWhere('external_id', $externalId);
            if ($row === null || ($facilityId !== null && ! ParkingMunicipal::where('dataset_source_id', $source->id)->whereKey($facilityId)->exists())) {
                throw ValidationException::withMessages(['identity' => 'De bronlocatie of gekoppelde locatie hoort niet bij deze dataset.']);
            }
            $decisions = $import->identity_decisions ?? [];
            $key = hash('sha256', $externalId);
            $decisions[$key] = [
                'facility_id' => $facilityId, 'reason' => $reason, 'actor_id' => $actor->id,
                'decided_at' => now()->toISOString(), 'previous' => $decisions[$key] ?? null,
            ];
            $import->forceFill(['identity_decisions' => $decisions])->save();
        });
    }

    protected function publish(DatasetImport $import, DatasetSource $source): void
    {
        $municipality = $source->municipality;
        $existing = ParkingMunicipal::where('dataset_source_id', $source->id)->get()->keyBy('id');
        $identities = $this->identity->resolve($import, $existing);
        $seen = [];
        $updates = [];
        $before = [];
        foreach ($import->records as $index => $record) {
            $externalId = $record['source']['external_id'];
            $space = $existing->get($identities[$index]['facility_id']);
            $id = $space?->id ?? (string) Str::uuid();
            $identities[$index]['facility_id'] = $id;
            $seen[] = $id;
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
            ->whereIn('id', $seen)
            ->toBase()->update(['last_checked_at' => now(), 'published_import_id' => $import->id]);
        $import->before_values = $before;
        $import->identity_resolution = $identities;
    }

    /** @param array<string, mixed> $attributes
     * @return array<string, mixed>
     */
    private function comparableSourceAttributes(array $attributes): array
    {
        $attributes = Arr::except($attributes, ['version_date']);
        if (isset($attributes['regimes'])) {
            $attributes['regimes'] = collect($attributes['regimes'])
                ->sortBy(fn (array $regime) => MunicipalSnapshot::fingerprint($regime))
                ->values()->all();
        }

        return $attributes;
    }

    private function value(ParkingMunicipal $space, string $field): mixed
    {
        $value = $space->getAttribute($field);

        return $value instanceof \BackedEnum ? $value->value : $value;
    }
}
