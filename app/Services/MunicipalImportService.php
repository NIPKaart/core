<?php

namespace App\Services;

use App\Contracts\DatasetImporter;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\ParkingMunicipal;
use App\Support\MunicipalSnapshot;
use App\Traits\StagesDatasetImports;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class MunicipalImportService implements DatasetImporter
{
    use StagesDatasetImports;

    public function __construct(private MunicipalSnapshot $snapshot) {}

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
                    $previous = $space->source_record[$field] ?? null;
                    if ($field === 'source_attributes') {
                        $value = $this->comparableSourceAttributes($value ?? []);
                        $previous = $this->comparableSourceAttributes($previous ?? []);
                    }
                    if (MunicipalSnapshot::fingerprint($value) !== MunicipalSnapshot::fingerprint($previous)) {
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
                'geometry_review_required' => ! empty($record['geometry_derivation']) && (! $space
                    || MunicipalSnapshot::fingerprint($record['source']['geometry']) !== MunicipalSnapshot::fingerprint($space->source_record['geometry'] ?? null)
                    || MunicipalSnapshot::fingerprint($record['geometry_derivation']) !== MunicipalSnapshot::fingerprint($space->geometry_derivation)),
                'previous_geometry_derivation' => $space?->geometry_derivation,
                'point' => ['latitude' => $record['values']['latitude'], 'longitude' => $record['values']['longitude']],
                'current' => $space?->only(['id', 'number', 'street', 'orientation', 'latitude', 'longitude', 'visibility']),
            ];
            $existing->forget($id);
        }
        foreach ($existing as $space) {
            $counts['missing']++;
            $rows[] = ['external_id' => $space->external_id, 'status' => 'missing', 'fields' => [], 'conflicts' => [], 'before' => $space->source_record, 'after' => null, 'point' => ['latitude' => $space->latitude, 'longitude' => $space->longitude], 'current' => $space->only(['id', 'visibility'])];
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
        if ($counts['conflict'] > 0) {
            $blockers[] = 'Bronwijzigingen conflicteren met handmatig aangepaste velden. Publicatie is geblokkeerd.';
        }

        return ['rows' => $rows, 'counts' => $counts, 'derivations' => $derivations, 'blockers' => $blockers, 'token' => MunicipalSnapshot::fingerprint([$source->configuration(), $source->last_published_retrieved_at, $rows])];
    }

    protected function publish(DatasetImport $import, DatasetSource $source): void
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
            ->toBase()->update(['last_checked_at' => now(), 'published_import_id' => $import->id]);
        $import->before_values = $before;
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
