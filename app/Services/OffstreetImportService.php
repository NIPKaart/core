<?php

namespace App\Services;

use App\Contracts\DatasetImporter;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\ParkingOffstreet;
use App\Support\MunicipalSnapshot;
use App\Support\OffstreetSnapshot;
use App\Traits\StagesDatasetImports;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

/**
 * Compares and publishes offstreet facility catalogs. Live occupancy is never part of a catalog.
 */
class OffstreetImportService implements DatasetImporter
{
    use StagesDatasetImports;

    /** Fields a catalog may set; manual changes to any of them are protected like municipal corrections. */
    private const array VALUES = ['name', 'parking_type', 'latitude', 'longitude', 'short_capacity', 'long_capacity', 'accessible_capacity'];

    public function __construct(private OffstreetSnapshot $snapshot) {}

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
            $status = ! $space ? 'new' : ($conflicts ? 'conflict' : ($fields ? 'changed' : 'unchanged'));
            $counts[$status]++;
            $rows[] = [
                'external_id' => $id, 'status' => $status, 'fields' => $fields, 'conflicts' => $conflicts,
                'before' => $space?->source_record, 'after' => $record['source'],
                'point' => ['latitude' => $record['values']['latitude'], 'longitude' => $record['values']['longitude']],
                'current' => $space?->only(['id', ...self::VALUES, 'visibility']),
            ];
            $existing->forget($id);
        }
        foreach ($existing as $space) {
            $counts['missing']++;
            $rows[] = ['external_id' => $space->external_id, 'status' => 'missing', 'fields' => [], 'conflicts' => [], 'before' => $space->source_record, 'after' => null, 'point' => ['latitude' => $space->latitude, 'longitude' => $space->longitude], 'current' => $space->only(['id', 'visibility'])];
        }
        $blockers = [];
        if (MunicipalSnapshot::fingerprint($source->configuration()) !== MunicipalSnapshot::fingerprint(Arr::except($import->dataset_config, ['publication_enabled']))) {
            $blockers[] = 'De datasetconfiguratie is gewijzigd sinds ontvangst. Lever een nieuw bestand aan.';
        }
        if ($source->last_published_retrieved_at && $import->retrieved_at->lessThanOrEqualTo($source->last_published_retrieved_at)) {
            $blockers[] = 'Deze levering is niet nieuwer dan de laatst gepubliceerde levering.';
        }
        if ($counts['conflict'] > 0) {
            $blockers[] = 'Bronwijzigingen conflicteren met handmatig aangepaste velden. Publicatie is geblokkeerd.';
        }

        return ['rows' => $rows, 'counts' => $counts, 'derivations' => 0, 'blockers' => $blockers, 'token' => MunicipalSnapshot::fingerprint([$source->configuration(), $source->last_published_retrieved_at, $rows])];
    }

    protected function publish(DatasetImport $import, DatasetSource $source): void
    {
        $municipality = $source->municipality;
        $existing = ParkingOffstreet::where('dataset_source_id', $source->id)->get()->keyBy('external_id');
        $updates = [];
        $before = [];
        foreach ($import->records as $record) {
            $externalId = $record['source']['external_id'];
            $space = $existing->get($externalId);
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
            $id = $space?->id ?? (string) Str::uuid();
            $before[$id] = $space ? Arr::except($space->getAttributes(), ['location']) : null;
            $updates[] = [
                'id' => $id, 'dataset_source_id' => $source->id, 'external_id' => $externalId,
                'country_id' => $municipality->country_id, 'province_id' => $municipality->province_id, 'municipality_id' => $municipality->id,
                ...$values, 'visibility' => $space?->visibility ?? true,
                // Live occupancy belongs to the observation stream; a catalog never sets or clears it.
                'free_space_short' => $space?->free_space_short, 'free_space_long' => $space?->free_space_long,
                'api_state' => $space?->getRawOriginal('api_state'),
                'source_record' => json_encode($record['source'], JSON_THROW_ON_ERROR),
                'last_imported_values' => json_encode($record['values'], JSON_THROW_ON_ERROR),
                'last_checked_at' => now(), 'created_at' => $space?->created_at ?? now(), 'updated_at' => now(),
            ];
        }
        foreach (array_chunk($updates, 100) as $chunk) {
            ParkingOffstreet::upsert($chunk, ['id'], [...self::VALUES, 'source_record', 'last_imported_values', 'last_checked_at', 'updated_at']);
        }
        ParkingOffstreet::where('dataset_source_id', $source->id)
            ->whereIn('external_id', array_column(array_column($import->records, 'source'), 'external_id'))
            ->toBase()->update(['last_checked_at' => now(), 'published_import_id' => $import->id]);
        $import->before_values = $before;
    }
}
