<?php

namespace App\Support;

use App\Models\DatasetSource;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use stdClass;

/**
 * Validates `nipkaart-municipal-2` deliveries. Rules specific to one upstream source live in its collector (ADR 0013).
 */
final class MunicipalSnapshot
{
    public const string FORMAT = 'nipkaart-municipal-2';

    public const int MAX_BYTES = SnapshotJson::MAX_BYTES;

    /** @return array<string, mixed> */
    public function decode(string $json): array
    {
        [$data, $object] = SnapshotJson::decode($json);
        Validator::make($data, [
            'format' => ['required', 'in:'.self::FORMAT],
            'dataset' => ['required', 'string', 'max:255'],
            'delivery_id' => ['required', 'uuid'],
            'retrieved_at' => ['required', 'string', 'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/', 'date'],
            'selection' => ['required', 'string', 'max:255'],
            'records' => ['required', 'array', 'list', 'min:1', 'max:10000'],
        ])->validate();
        if (($data['complete'] ?? null) !== true || ! is_int($data['source_count'] ?? null) || $data['source_count'] !== count($data['records'])) {
            $this->fail('file', 'De levering moet volledig zijn en het bronaantal moet overeenkomen.');
        }
        if (CarbonImmutable::parse($data['retrieved_at'])->isFuture()) {
            $this->fail('retrieved_at', 'Het ophaaltijdstip ligt in de toekomst.');
        }
        if (! ($object->source ?? null) instanceof stdClass) {
            $this->fail('source', 'De levering moet een bronbeschrijving bevatten.');
        }
        $data['source'] = SourceDescription::validate($data['source']);
        foreach ($object->records as $index => $record) {
            if (! $record instanceof stdClass || ! ($record->geometry ?? null) instanceof stdClass || ! ($record->source_attributes ?? null) instanceof stdClass) {
                $this->fail("records.$index", 'Een record, geometrie en bronattributen moeten objecten zijn.');
            }
        }

        return $data;
    }

    /** @param array<string, mixed> $data
     * @return list<array<string, mixed>>
     */
    public function validate(array $data, DatasetSource $source): array
    {
        if ($source->target_type !== 'municipal' || $source->code !== $data['dataset'] || $source->selection !== $data['selection']) {
            $this->fail('dataset', 'Dataset of selectie hoort niet bij deze bron.');
        }
        $seen = [];
        foreach ($data['records'] as $index => $record) {
            $prefix = "records.$index";
            $errors = Validator::make($record, [
                'external_id' => ['required', 'string', 'max:255'],
                'number' => ['present', 'nullable', 'integer', 'min:0', 'max:2147483647'],
                'street' => ['present', 'nullable', 'string', 'max:255'],
                'access_category' => ['required', 'in:general,unknown'],
                'orientation' => ['present', 'nullable', 'in:perpendicular,parallel,angle'],
                'source_updated_at' => ['present', 'nullable', 'date_format:Y-m-d'],
                'source_attributes' => ['present', 'array'],
                'geometry.type' => ['required', 'in:Point,Polygon,MultiPolygon'],
                'geometry.coordinates' => ['required', 'array', 'list'],
            ])->errors();
            if ($errors->isNotEmpty()) {
                throw ValidationException::withMessages(collect($errors->messages())->mapWithKeys(fn ($messages, $field) => ["$prefix.$field" => $messages])->all());
            }
            if ($record['external_id'] !== trim($record['external_id']) || isset($seen[$record['external_id']])) {
                $this->fail("$prefix.external_id", 'Bron-ID is ongeldig of dubbel.');
            }
            $seen[$record['external_id']] = true;
            if ($record['number'] !== null && ! is_int($record['number'])) {
                $this->fail("$prefix.number", 'Verwacht een geheel aantal of null.');
            }
            // `nullable` treats an empty string as missing; unknown must be an explicit null.
            if ($record['source_updated_at'] !== null && (! is_string($record['source_updated_at']) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/D', $record['source_updated_at']))) {
                $this->fail("$prefix.source_updated_at", 'Verwacht een datum (JJJJ-MM-DD) of null.');
            }
            $polygons = match ($record['geometry']['type']) {
                'Point' => [[[$record['geometry']['coordinates']]]],
                'Polygon' => [$record['geometry']['coordinates']],
                'MultiPolygon' => $record['geometry']['coordinates'],
            };
            $positions = 0;
            foreach ($polygons as $polygon) {
                foreach (is_array($polygon) ? $polygon : [null] as $ring) {
                    $closed = $record['geometry']['type'] === 'Point' || (is_array($ring) && array_is_list($ring) && count($ring) >= 4 && $ring[0] === $ring[array_key_last($ring)]);
                    if (! is_array($ring) || ! array_is_list($ring) || ! $closed) {
                        $this->fail("$prefix.geometry", 'Ongeldige of niet gesloten polygoonring.');
                    }
                    $positions += count($ring);
                    if ($positions > 10000) {
                        $this->fail("$prefix.geometry", 'Te veel posities in de geometrie.');
                    }
                    foreach ($ring as $point) {
                        if (! is_array($point) || ! array_is_list($point) || count($point) !== 2
                            || (! is_int($point[0]) && ! is_float($point[0])) || (! is_int($point[1]) && ! is_float($point[1]))
                            || ! is_finite($point[0]) || ! is_finite($point[1])
                            || $point[0] < -180 || $point[0] > 180 || $point[1] < -90 || $point[1] > 90) {
                            $this->fail("$prefix.geometry", 'Ongeldige WGS84-coördinaten.');
                        }
                    }
                }
            }
        }
        [$west, $south, $east, $north] = $source->bounds;
        $rows = DB::select(<<<'SQL'
            WITH shapes AS (
                SELECT item->>'external_id' AS external_id, ST_SetSRID(ST_GeomFromGeoJSON((item->'geometry')::text),4326) AS shape
                FROM jsonb_array_elements(?::jsonb) AS item
            ), assessed AS (
                SELECT *, ST_IsValid(shape) AS original_valid, ST_IsValidReason(shape) AS reason FROM shapes
            ), derived AS (
                SELECT *, CASE WHEN original_valid THEN shape ELSE ST_MakeValid(shape, 'method=linework') END AS usable FROM assessed
            ), points AS (
                SELECT *, ST_PointOnSurface(usable) AS point FROM derived
            ) SELECT external_id, original_valid, reason,
                ST_IsValid(usable) AND NOT ST_IsEmpty(usable) AND CASE WHEN GeometryType(shape) = 'POINT'
                    THEN GeometryType(usable) = 'POINT' ELSE GeometryType(usable) IN ('POLYGON', 'MULTIPOLYGON') END AS usable,
                ST_CoveredBy(ST_Envelope(shape), ST_MakeEnvelope(?, ?, ?, ?, 4326)) AS inside,
                ST_X(point) AS longitude, ST_Y(point) AS latitude,
                CASE WHEN NOT original_valid THEN ST_AsGeoJSON(usable, 15, 0) END AS geometry,
                PostGIS_Lib_Version() || ' / GEOS ' || PostGIS_GEOS_Version() AS engine
            FROM points
            SQL, [json_encode($data['records'], JSON_THROW_ON_ERROR), $west, $south, $east, $north]);
        $points = [];
        $derivations = [];
        $errors = [];
        foreach ($rows as $row) {
            if (! $row->usable || ! $row->inside) {
                $errors["geometry.{$row->external_id}"] = "Bron-ID {$row->external_id}: ".(! $row->inside ? 'buiten het toegelaten gebied.' : "geen bruikbare geometrie na afleiding: {$row->reason}");

                continue;
            }
            $points[$row->external_id] = ['longitude' => round($row->longitude, 7), 'latitude' => round($row->latitude, 7)];
            $derivations[$row->external_id] = $row->original_valid ? null : [
                'method' => 'st_makevalid_linework', 'reason' => $row->reason, 'engine' => $row->engine,
                'geometry' => json_decode($row->geometry, true, 32, JSON_THROW_ON_ERROR),
            ];
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return array_map(fn ($record) => [
            'source' => $record,
            'geometry_derivation' => $derivations[$record['external_id']],
            'values' => [
                'street' => $record['street'], 'number' => $record['number'], 'orientation' => $record['orientation'],
                ...$points[$record['external_id']],
            ],
        ], $data['records']);
    }

    /** Canonical comparison ignores object key ordering while preserving array order. */
    public static function fingerprint(mixed $value): string
    {
        $normalize = function (mixed $item) use (&$normalize): mixed {
            if (! is_array($item)) {
                return $item;
            }
            if (! array_is_list($item)) {
                ksort($item);
            }

            return array_map($normalize, $item);
        };

        return hash('sha256', json_encode($normalize($value), JSON_THROW_ON_ERROR));
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
