<?php

namespace App\Services;

use App\Models\DatasetImport;
use App\Models\ParkingMunicipal;
use App\Support\MunicipalSnapshot;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Reconciles original municipal claims to retained UUIDs; adjacent bays are never merged by proximity alone. */
class MunicipalIdentityService
{
    /**
     * @param  Collection<string, ParkingMunicipal>  $spaces
     * @return list<array<string, mixed>>
     */
    public function resolve(DatasetImport $import, Collection $spaces): array
    {
        if ($import->state === 'published' && $import->identity_resolution !== null) {
            return $import->identity_resolution;
        }
        $previous = DatasetImport::where('dataset_source_id', $import->dataset_source_id)
            ->where('state', 'published')->orderByDesc('retrieved_at')->first();
        $aliases = collect($previous?->identity_resolution ?? [])->keyBy('external_id');
        $candidates = $this->candidates($import);
        $rows = [];
        foreach ($import->records as $record) {
            $externalId = $record['source']['external_id'];
            $options = $candidates[$externalId] ?? [];
            $knownId = $aliases->get($externalId)['facility_id'] ?? null;
            if ($previous?->identity_resolution === null) {
                $legacy = $spaces->where('external_id', $externalId);
                $knownId = $legacy->count() === 1 ? $legacy->first()->id : null;
            }
            $exact = array_values(array_filter($options, fn (array $option): bool => $option['same_geometry'] && $option['same_name'] && $option['same_type']));
            $context = array_values(array_filter($exact, fn (array $option): bool => $option['same_source_context']));
            $known = collect($options)->firstWhere('id', $knownId);
            $id = null;
            $method = 'new';
            if ($known !== null && $known['same_geometry'] && (count($context) !== 1 || $context[0]['id'] === $knownId)) {
                $id = $knownId;
                $method = 'source_id';
            } elseif (count($exact) === 1) {
                $id = $exact[0]['id'];
                $method = 'geometry';
            } elseif (count($context) === 1) {
                $id = $context[0]['id'];
                $method = 'source_context';
            } elseif ($knownId !== null || $options !== []) {
                $method = 'review';
            }
            $decision = $import->identity_decisions[hash('sha256', $externalId)] ?? null;
            if ($decision !== null) {
                $id = $decision['facility_id'];
                $method = $id === null || $spaces->has($id) ? 'manual' : 'review';
            }
            $rows[] = ['external_id' => $externalId, 'facility_id' => $id, 'method' => $method, 'candidates' => $options, 'decision' => $decision];
        }
        $assigned = array_count_values(array_filter(array_column($rows, 'facility_id')));
        foreach ($rows as &$row) {
            if ($row['facility_id'] !== null && $assigned[$row['facility_id']] > 1) {
                $row['method'] = 'review';
            }
        }

        return $rows;
    }

    /** @return array<string, list<array<string, mixed>>> */
    private function candidates(DatasetImport $import): array
    {
        $records = array_map(fn (array $record): array => [
            'external_id' => $record['source']['external_id'], 'source' => $record['source'],
        ], $import->records);
        $rows = DB::select(<<<'SQL'
            WITH incoming AS (
                SELECT external_id, source,
                    ST_Centroid(ST_MakeValid(ST_GeomFromGeoJSON(source->'geometry')))::geography AS position
                FROM jsonb_to_recordset(?::jsonb) AS r(external_id text, source jsonb)
            ), existing AS (
                SELECT id, external_id, source_record,
                    ST_Centroid(ST_MakeValid(ST_GeomFromGeoJSON(source_record->'geometry')))::geography AS position
                FROM parking_municipal_spaces WHERE dataset_source_id = ?
            )
            SELECT incoming.external_id, existing.id, existing.source_record,
                incoming.source, ST_Distance(incoming.position, existing.position) AS distance_metres
            FROM incoming JOIN existing ON existing.external_id = incoming.external_id
                OR existing.source_record->>'external_id' = incoming.external_id
                OR ST_DWithin(incoming.position, existing.position, 20)
            ORDER BY incoming.external_id, distance_metres, existing.id
            SQL, [json_encode($records, JSON_THROW_ON_ERROR), $import->dataset_source_id]);
        $result = [];
        foreach ($rows as $row) {
            $source = json_decode($row->source, true, flags: JSON_THROW_ON_ERROR);
            $old = json_decode($row->source_record, true, flags: JSON_THROW_ON_ERROR);
            $context = $this->sourceContext($source);
            $result[$row->external_id][] = [
                'id' => $row->id, 'name' => $old['street'] ?? $old['external_id'],
                'distance_metres' => (float) $row->distance_metres,
                'same_geometry' => MunicipalSnapshot::fingerprint($old['geometry']) === MunicipalSnapshot::fingerprint($source['geometry']),
                'same_name' => ($old['street'] ?? null) === ($source['street'] ?? null),
                'same_type' => $old['access_category'] === $source['access_category'],
                'same_source_context' => $context !== [] && MunicipalSnapshot::fingerprint($this->sourceContext($old)) === MunicipalSnapshot::fingerprint($context),
            ];
        }

        return $result;
    }

    /**
     * Compare original claims without GeoJSON feature IDs that merely repeat the rotating source ID.
     *
     * @param  array<string, mixed>  $record
     * @return array<string, mixed>
     */
    private function sourceContext(array $record): array
    {
        $attributes = $record['source_attributes'] ?? [];
        if (($attributes['type'] ?? null) === 'Feature' && ($attributes['id'] ?? null) === $record['external_id']) {
            unset($attributes['id']);
            $featureId = $attributes['properties']['FID'] ?? null;
            if (is_int($featureId) && str_ends_with($record['external_id'], '.'.$featureId)) {
                unset($attributes['properties']['FID']);
            }
        }

        return $attributes;
    }
}
