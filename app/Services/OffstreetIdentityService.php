<?php

namespace App\Services;

use App\Models\DatasetImport;
use App\Models\ParkingOffstreet;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Resolves source records within one dataset; publication retains the plan as versioned identity evidence. */
class OffstreetIdentityService
{
    /**
     * @param  Collection<string, ParkingOffstreet>  $facilities
     * @return list<array<string, mixed>>
     */
    public function resolve(DatasetImport $import, Collection $facilities, bool $trustSourceIds = true): array
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
                $legacy = $facilities->where('external_id', $externalId);
                $knownId = $legacy->count() === 1 ? $legacy->first()->id : null;
            }
            if (! $trustSourceIds) {
                $knownId = null;
            }
            $known = collect($options)->firstWhere('id', $knownId);
            $strong = array_values(array_filter($options, fn (array $option): bool => $option['same_name'] && $option['same_type'] && $option['distance_metres'] <= 30));
            $facilityId = null;
            $method = 'new';
            if ($known !== null && $known['same_type'] && ($known['same_name'] || $known['same_source_name']) && $known['distance_metres'] <= 200) {
                $facilityId = $knownId;
                $method = 'source_id';
            } elseif ($knownId === null && count(array_filter($options, fn (array $option): bool => $option['distance_metres'] <= 200)) === 1 && count($strong) === 1) {
                $facilityId = $strong[0]['id'];
                $method = 'name_type_location';
            } elseif ($knownId !== null || $options !== []) {
                $method = 'review';
            }
            $decision = $import->identity_decisions[hash('sha256', $externalId)] ?? null;
            if ($decision !== null) {
                $facilityId = $decision['facility_id'];
                $method = $facilityId === null || $facilities->has($facilityId) ? 'manual' : 'review';
            }
            $rows[] = [
                'external_id' => $externalId, 'facility_id' => $facilityId, 'method' => $method,
                'candidates' => $options, 'decision' => $decision,
            ];
        }
        $assigned = [];
        foreach ($rows as $row) {
            if ($row['facility_id'] !== null) {
                $assigned[$row['facility_id']] = ($assigned[$row['facility_id']] ?? 0) + 1;
            }
        }
        foreach ($rows as &$row) {
            if ($row['facility_id'] !== null && $assigned[$row['facility_id']] > 1) {
                $row['method'] = 'review';
            }
        }

        return $rows;
    }

    /**
     * PostGIS measures source positions, rather than local display corrections. The query batches all records
     * and limits candidates to the same source, nearby facilities, matching names or a potentially reused ID.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    private function candidates(DatasetImport $import): array
    {
        $records = array_map(fn (array $record): array => [
            'external_id' => $record['source']['external_id'], 'name' => $record['source']['name'],
            'source_name' => $record['source']['source_name'], 'type' => $record['values']['parking_type'],
            'longitude' => $record['values']['longitude'], 'latitude' => $record['values']['latitude'],
        ], $import->records);
        $rows = DB::select(<<<'SQL'
            SELECT incoming.external_id, facility.id, facility.name,
                facility.source_record, facility.parking_type,
                ST_Distance(
                    ST_SetSRID(ST_MakePoint(incoming.longitude, incoming.latitude), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(
                        COALESCE((facility.source_record->'geometry'->'coordinates'->>0)::double precision, facility.longitude),
                        COALESCE((facility.source_record->'geometry'->'coordinates'->>1)::double precision, facility.latitude)
                    ), 4326)::geography
                ) AS distance_metres,
                incoming.name AS incoming_name, incoming.source_name AS incoming_source_name,
                incoming.type AS incoming_type
            FROM jsonb_to_recordset(?::jsonb) AS incoming(external_id text, name text, source_name text, type text, longitude double precision, latitude double precision)
            JOIN parking_offstreet_spaces facility ON facility.dataset_source_id = ?
            WHERE facility.external_id = incoming.external_id
                OR lower(facility.source_record->>'name') = lower(incoming.name)
                OR ST_DWithin(facility.location, ST_SetSRID(ST_MakePoint(incoming.longitude, incoming.latitude), 4326)::geography, 200)
            ORDER BY incoming.external_id, distance_metres, facility.id
            SQL, [json_encode($records, JSON_THROW_ON_ERROR), $import->dataset_source_id]);
        $result = [];
        foreach ($rows as $row) {
            $source = $row->source_record === null ? [] : json_decode($row->source_record, true, flags: JSON_THROW_ON_ERROR);
            $sameName = $this->normalize($source['name'] ?? $row->name) === $this->normalize($row->incoming_name)
                && $this->normalize($source['source_name'] ?? $row->name) === $this->normalize($row->incoming_source_name);
            $result[$row->external_id][] = [
                'id' => $row->id, 'name' => $source['name'] ?? $row->name,
                'source_external_id' => $source['external_id'] ?? null,
                'distance_metres' => (float) $row->distance_metres,
                'same_name' => $sameName, 'same_source_name' => $this->normalize($source['source_name'] ?? $row->name) === $this->normalize($row->incoming_source_name), 'same_type' => $row->parking_type === $row->incoming_type,
            ];
        }

        return $result;
    }

    private function normalize(string $value): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $value)));
    }
}
