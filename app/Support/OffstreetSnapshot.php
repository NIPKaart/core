<?php

namespace App\Support;

use App\Models\DatasetSource;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use stdClass;

/**
 * Validates `nipkaart-offstreet-catalog-2` deliveries: facility identity and static metadata only.
 * Live values (free spaces, feed state) arrive in a separate observation stream (#1221).
 */
final class OffstreetSnapshot
{
    public const string FORMAT = 'nipkaart-offstreet-catalog-2';

    private const array FIELDS = ['external_id', 'name', 'source_name', 'facility_type', 'geometry', 'short_capacity', 'long_capacity', 'accessible_capacity'];

    private const array COUNTS = ['short_capacity', 'long_capacity', 'accessible_capacity'];

    /** @return array<string, mixed> */
    public function decode(string $json): array
    {
        [$data, $object] = SnapshotJson::decode($json);
        Validator::make($data, [
            'format' => ['required', 'in:'.self::FORMAT],
            'dataset' => ['required', 'string', 'max:255'],
            'delivery_id' => ['required', 'uuid'],
            'retrieved_at' => ['required', 'string', 'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/', 'date'],
            'selection' => ['required', 'string'],
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
            if (! $record instanceof stdClass || ! ($record->geometry ?? null) instanceof stdClass) {
                $this->fail("records.$index", 'Een record en zijn geometrie moeten objecten zijn.');
            }
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array{source: array<string, mixed>, values: array<string, mixed>}>
     */
    public function validate(array $data, DatasetSource $source): array
    {
        if ($source->target_type !== 'offstreet' || $source->code !== $data['dataset'] || $data['selection'] !== $source->selection) {
            $this->fail('dataset', 'Dataset of selectie is niet toegelaten voor deze bron.');
        }
        [$west, $south, $east, $north] = $source->bounds;
        $seen = [];
        $records = [];
        foreach ($data['records'] as $index => $record) {
            $prefix = "records.$index";
            if (array_diff(array_keys($record), self::FIELDS) !== [] || array_diff(self::FIELDS, array_keys($record)) !== []) {
                $this->fail($prefix, 'Onverwachte of ontbrekende catalogusvelden.');
            }
            foreach (['external_id', 'name', 'source_name'] as $field) {
                if (! is_string($record[$field]) || trim($record[$field]) === '' || mb_strlen($record[$field]) > 255) {
                    $this->fail("$prefix.$field", 'Verwacht een niet-lege tekst van maximaal 255 tekens.');
                }
            }
            $id = $record['external_id'];
            if ($id !== trim($id) || isset($seen[$id])) {
                $this->fail("$prefix.external_id", 'Bron-ID is ongeldig of dubbel.');
            }
            $seen[$id] = true;
            if (! in_array($record['facility_type'], ['garage', 'park_and_ride'], true)) {
                $this->fail("$prefix.facility_type", 'Onbekend type parkeervoorziening.');
            }
            foreach (self::COUNTS as $field) {
                if ($record[$field] !== null && (! is_int($record[$field]) || $record[$field] < 0 || $record[$field] > 2147483647)) {
                    $this->fail("$prefix.$field", 'Verwacht een geheel aantal of null; onbekend blijft null.');
                }
            }
            $geometry = $record['geometry'];
            $coordinates = $geometry['coordinates'] ?? null;
            if (array_keys($geometry) !== ['type', 'coordinates'] && array_keys($geometry) !== ['coordinates', 'type']
                || $geometry['type'] !== 'Point' || ! is_array($coordinates) || ! array_is_list($coordinates) || count($coordinates) !== 2) {
                $this->fail("$prefix.geometry", 'Verwacht een WGS84-punt.');
            }
            [$longitude, $latitude] = $coordinates;
            if ((! is_int($longitude) && ! is_float($longitude)) || (! is_int($latitude) && ! is_float($latitude))
                || ! is_finite($longitude) || ! is_finite($latitude) || abs($longitude) > 180 || abs($latitude) > 90) {
                $this->fail("$prefix.geometry", 'Ongeldige WGS84-coördinaten.');
            }
            if ($longitude < $west || $longitude > $east || $latitude < $south || $latitude > $north) {
                $this->fail("geometry.$id", "Bron-ID $id: buiten het toegelaten gebied.");
            }
            $records[] = [
                'source' => $record,
                'values' => [
                    'name' => $record['name'],
                    'parking_type' => $record['facility_type'] === 'park_and_ride' ? 'parkandride' : 'garage',
                    'latitude' => round((float) $latitude, 7), 'longitude' => round((float) $longitude, 7),
                    'short_capacity' => $record['short_capacity'], 'long_capacity' => $record['long_capacity'],
                    'accessible_capacity' => $record['accessible_capacity'],
                ],
            ];
        }

        return $records;
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
