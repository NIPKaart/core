<?php

namespace App\Services;

use App\Contracts\DatasetImporter;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\ParkingOffstreet;
use App\Models\User;
use App\Support\MunicipalSnapshot;
use App\Support\OffstreetSnapshot;
use App\Traits\StagesDatasetImports;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Compares and publishes offstreet facility catalogs. Live occupancy is never part of a catalog.
 */
class OffstreetImportService implements DatasetImporter
{
    use StagesDatasetImports;

    /** Fields a catalog may set; manual changes to any of them are protected like municipal corrections. */
    private const array VALUES = ['name', 'parking_type', 'latitude', 'longitude'];

    public function __construct(private OffstreetSnapshot $snapshot, private OffstreetIdentityService $identity) {}

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

    /** @return array{rows: list<array<string, mixed>>, counts: array<string, int>, derivations: int, blockers: list<string>, token: string} */
    public function review(DatasetImport $import, bool $lock = false): array
    {
        $source = $import->datasetSource;
        $query = ParkingOffstreet::where('dataset_source_id', $source->id)->orderBy('id');
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
            $fields = [];
            $conflicts = [];
            if ($space) {
                foreach (array_unique([...array_keys($record['source']), ...array_keys($space->source_record ?? [])]) as $field) {
                    if (MunicipalSnapshot::fingerprint($record['source'][$field] ?? null) !== MunicipalSnapshot::fingerprint($space->source_record[$field] ?? null)) {
                        $fields[] = $field;
                    }
                }
                foreach ($record['values'] as $field => $value) {
                    $current = MunicipalSnapshot::fingerprint($space->getAttribute($field));
                    $imported = MunicipalSnapshot::fingerprint($space->last_imported_values[$field] ?? null);
                    // A manual change conflicts only when the source also changes the field to a different value.
                    if ($space->last_imported_values === null || ($current !== $imported && MunicipalSnapshot::fingerprint($value) !== $imported && MunicipalSnapshot::fingerprint($value) !== $current)) {
                        $conflicts[] = $field;
                    }
                }
            }
            $status = $identity['method'] === 'review' ? 'conflict' : (! $space ? 'new' : ($conflicts ? 'conflict' : ($fields ? 'changed' : 'unchanged')));
            $counts[$status]++;
            $rows[] = [
                'external_id' => $id, 'identity' => $identity, 'status' => $status, 'fields' => $fields, 'conflicts' => $conflicts,
                'before' => $space?->source_record, 'after' => $record['source'],
                'point' => ['latitude' => $record['values']['latitude'], 'longitude' => $record['values']['longitude']],
                'current' => $space?->only(['id', ...self::VALUES, 'visibility']),
            ];
            $existing->forget($identity['facility_id']);
        }
        foreach ($existing as $space) {
            $counts['missing']++;
            $rows[] = ['external_id' => $space->source_record['external_id'] ?? $space->external_id, 'status' => 'missing', 'fields' => [], 'conflicts' => [], 'before' => $space->source_record, 'after' => null, 'point' => ['latitude' => $space->latitude, 'longitude' => $space->longitude], 'current' => $space->only(['id', 'visibility'])];
        }
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

        return ['observation_reference_required' => $source->requires_identity_context || collect($rows)->contains(fn (array $row): bool => $row['before'] !== null && $row['after'] !== null && $row['before']['external_id'] !== $row['after']['external_id']), 'identities' => $identities, 'rows' => $rows, 'counts' => $counts, 'derivations' => 0, 'blockers' => $blockers, 'token' => MunicipalSnapshot::fingerprint([$source->configuration(), $source->last_published_retrieved_at, $rows, $import->identity_decisions])];
    }

    /** Records an explicit identity decision without changing published facilities. */
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
            if ($row === null || ($facilityId !== null && ! ParkingOffstreet::where('dataset_source_id', $source->id)->whereKey($facilityId)->exists())) {
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
        $existing = ParkingOffstreet::where('dataset_source_id', $source->id)->get()->keyBy('id');
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
            if (($space && ($space->source_record['external_id'] ?? $space->external_id) !== $externalId)
                || $existing->contains(fn (ParkingOffstreet $other): bool => $other->external_id === $externalId && $other->id !== $id)) {
                $source->requires_identity_context = true;
            }
            if ($space && MunicipalSnapshot::fingerprint($space->source_record) === MunicipalSnapshot::fingerprint($record['source'])) {
                continue;
            }
            $values = $record['values'];
            if ($space) {
                foreach ($values as $field => $value) {
                    if ($space->last_imported_values === null || MunicipalSnapshot::fingerprint($space->getAttribute($field)) !== MunicipalSnapshot::fingerprint($space->last_imported_values[$field] ?? null)) {
                        $values[$field] = $space->getAttribute($field);
                    }
                }
            }
            $before[$id] = $space ? Arr::except($space->getAttributes(), ['location']) : null;
            $updates[] = [
                'id' => $id, 'dataset_source_id' => $source->id, 'external_id' => $externalId,
                'country_id' => $municipality->country_id, 'province_id' => $municipality->province_id, 'municipality_id' => $municipality->id,
                ...$values, 'visibility' => $space?->visibility ?? true,
                // Capacity and occupancy belong to the observation stream; the upsert never touches those columns.
                'source_record' => json_encode($record['source'], JSON_THROW_ON_ERROR),
                'last_imported_values' => json_encode($record['values'], JSON_THROW_ON_ERROR),
                'last_checked_at' => now(), 'created_at' => $space?->created_at ?? now(), 'updated_at' => now(),
            ];
        }
        foreach (array_chunk($updates, 100) as $chunk) {
            ParkingOffstreet::upsert($chunk, ['id'], [...self::VALUES, 'source_record', 'last_imported_values', 'last_checked_at', 'updated_at']);
        }
        ParkingOffstreet::where('dataset_source_id', $source->id)
            ->whereIn('id', $seen)
            ->toBase()->update(['last_checked_at' => now(), 'published_import_id' => $import->id, 'missing_since' => null, 'consecutive_missing_deliveries' => 0]);
        ParkingOffstreet::where('dataset_source_id', $source->id)->whereNotIn('id', $seen)
            ->toBase()->update([
                'missing_since' => DB::raw('COALESCE(missing_since, CURRENT_TIMESTAMP)'),
                'consecutive_missing_deliveries' => DB::raw('consecutive_missing_deliveries + 1'),
            ]);
        $import->before_values = $before;
        $import->identity_resolution = $identities;
    }
}
