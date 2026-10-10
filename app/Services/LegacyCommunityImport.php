<?php

namespace App\Services;

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Enums\UnderSign;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use InvalidArgumentException;
use Ramsey\Uuid\Uuid;

/**
 * One-time transfer of community places and rule links; accounts and source feeds stay separate.
 *
 * Query-builder writes deliberately avoid notifications and invented moderator decisions.
 */
final class LegacyCommunityImport
{
    /**
     * @param  array<string, list<array<string, ?string>>>  $tables
     * @return array{spaces: int, rules: int, new_spaces: int, new_rules: int, unchanged_spaces: int, unchanged_rules: int, approved: int, pending: int, rejected: int, municipalities: int}
     */
    public function run(array $tables, bool $write = false): array
    {
        $countries = $this->index($tables['countries']);
        $provinces = $this->index($tables['provinces']);
        $statuses = $this->index($tables['location_status']);
        $this->index($tables['parking_locations']);
        $this->index($tables['parking_rules']);
        $hints = [];
        foreach (['parking_locations', 'parking_cities', 'parking_offstreet'] as $table) {
            foreach ($tables[$table] ?? [] as $row) {
                $hints[$row['country_id'].'/'.$this->name($row['municipality'])][$row['province_id']] = true;
            }
        }

        $spaces = [];
        foreach ($tables['parking_locations'] as $row) {
            $this->validate($row, [
                'id' => ['required', 'string', 'max:255'],
                'country_id' => ['required'], 'province_id' => ['required'], 'municipality' => ['required', 'string', 'max:255'],
                'latitude' => ['required', 'numeric', 'between:-90,90'], 'longitude' => ['required', 'numeric', 'between:-180,180'],
                'status_id' => ['required'], 'orientation' => ['required', 'in:File,Haaks,Visgraat'],
                'city' => ['present', 'string', 'max:255'], 'street' => ['present', 'string', 'max:255'], 'postcode' => ['present', 'string', 'max:255'],
                'suburb' => ['present', 'nullable', 'string', 'max:255'], 'neighbourhood' => ['present', 'nullable', 'string', 'max:255'],
                'amenity' => ['present', 'nullable', 'string', 'max:255'], 'description' => ['present', 'nullable', 'string'],
                'parking_time' => ['present', 'nullable', 'integer', 'min:0'], 'parking_disc' => ['required', 'in:0,1'], 'window_times' => ['required', 'in:0,1'],
                'created_at' => ['required', 'date_format:Y-m-d H:i:s'], 'updated_at' => ['required', 'date_format:Y-m-d H:i:s'],
                'deleted_at' => ['present', 'nullable', 'date_format:Y-m-d H:i:s'],
            ], 'parking_locations');
            $status = match ($statuses[$row['status_id']]['name'] ?? null) {
                'In review' => ParkingStatus::PENDING->value,
                'Approved' => ParkingStatus::APPROVED->value,
                'Declined' => ParkingStatus::REJECTED->value,
                default => throw new InvalidArgumentException('Unknown legacy publication status.'),
            };
            $spaces[] = [
                'area' => $this->area($row, $countries, $provinces),
                'attributes' => [
                    'id' => Uuid::uuid5(Uuid::NAMESPACE_URL, 'https://nipkaart.nl/legacy/parking_locations/'.$row['id'])->toString(),
                    'user_id' => null, 'ip_address' => null,
                    'status' => $status,
                    'orientation' => match ($row['orientation']) {
                        'File' => ParkingOrientation::PARALLEL->value,
                        'Haaks' => ParkingOrientation::PERPENDICULAR->value,
                        'Visgraat' => ParkingOrientation::ANGLE->value,
                    },
                    'latitude' => sprintf('%.7f', (float) $row['latitude']),
                    'longitude' => sprintf('%.7f', (float) $row['longitude']),
                    'city' => $row['city'], 'suburb' => $row['suburb'], 'neighbourhood' => $row['neighbourhood'],
                    'postcode' => $row['postcode'], 'street' => $row['street'], 'amenity' => $row['amenity'],
                    'description' => $row['description'],
                    'parking_time' => $row['parking_time'] === null ? null : (int) $row['parking_time'],
                    'parking_disc' => $row['parking_disc'] === '1',
                    'under_sign' => $row['window_times'] === '1' || (int) $row['parking_time'] > 0 ? UnderSign::YES->value : null,
                    'under_sign_text' => null, 'restriction_days' => null, 'restriction_starts_at' => null, 'restriction_ends_at' => null,
                    'created_at' => $row['created_at'], 'updated_at' => $row['updated_at'], 'deleted_at' => $row['deleted_at'],
                ],
            ];
        }

        $rules = [];
        $scopes = [];
        foreach ($tables['parking_rules'] as $row) {
            $this->validate($row, [
                'country_id' => ['required'], 'municipality' => ['present', 'string'], 'nationwide' => ['required', 'in:0,1'],
                'url' => ['required', 'url:http,https', 'max:255'],
                'created_at' => ['required', 'date_format:Y-m-d H:i:s'], 'updated_at' => ['required', 'date_format:Y-m-d H:i:s'],
            ], 'parking_rules');
            $national = $row['nationwide'] === '1';
            $provinceIds = array_keys($hints[$row['country_id'].'/'.$this->name($row['municipality'])] ?? []);
            if (! $national && count($provinceIds) !== 1) {
                throw new InvalidArgumentException('A rule municipality has missing or ambiguous province evidence: '.$row['municipality'].'.');
            }
            $area = $this->area([...$row, 'province_id' => $national ? null : (string) $provinceIds[0]], $countries, $provinces);
            $scope = $area['country']['code'].'/'.($national ? '*' : $this->name($row['municipality']));
            if (isset($scopes[$scope])) {
                throw new InvalidArgumentException('Duplicate legacy parking-rule scope.');
            }
            $scopes[$scope] = true;
            $rules[] = ['area' => $area, 'attributes' => [
                'url' => $row['url'], 'nationwide' => $national,
                'created_at' => $row['created_at'], 'updated_at' => $row['updated_at'],
            ]];
        }

        return DB::transaction(function () use ($spaces, $rules, $write): array {
            $knownCountries = DB::table('countries')->get()->map(fn ($row) => (array) $row)->all();
            $knownProvinces = DB::table('provinces')->get()->map(fn ($row) => (array) $row)->all();
            $knownMunicipalities = DB::table('municipalities')->get()->map(fn ($row) => (array) $row)->all();
            $knownSpaces = DB::table('parking_spaces')->whereIn('id', array_column(array_column($spaces, 'attributes'), 'id'))->get()->keyBy('id');
            $knownRules = DB::table('parking_rules')->get();
            $result = ['spaces' => count($spaces), 'rules' => count($rules), 'new_spaces' => 0, 'new_rules' => 0, 'unchanged_spaces' => 0, 'unchanged_rules' => 0, 'approved' => 0, 'pending' => 0, 'rejected' => 0, 'municipalities' => 0];
            foreach ($spaces as $space) {
                $attributes = [...$space['attributes'], ...$this->resolve($space['area'], $knownCountries, $knownProvinces, $knownMunicipalities, $write, $result)];
                $result[$attributes['status']]++;
                $existing = $knownSpaces->get($attributes['id']);
                if ($existing !== null) {
                    $this->same((array) $existing, $attributes, 'community place');
                    $result['unchanged_spaces']++;
                } else {
                    if ($write) {
                        DB::table('parking_spaces')->insert($attributes);
                    }
                    $result['new_spaces']++;
                }
            }
            foreach ($rules as $rule) {
                $area = $this->resolve($rule['area'], $knownCountries, $knownProvinces, $knownMunicipalities, $write, $result);
                $attributes = [...$rule['attributes'], 'country_id' => $area['country_id'], 'municipality_id' => $area['municipality_id']];
                $matches = $knownRules->filter(fn ($existing) => $existing->country_id === $attributes['country_id'] && $existing->municipality_id === $attributes['municipality_id']);
                if ($matches->count() > 1) {
                    throw new InvalidArgumentException('Ambiguous existing parking-rule scope.');
                }
                if ($matches->isNotEmpty()) {
                    $this->same((array) $matches->first(), $attributes, 'parking rule');
                    $result['unchanged_rules']++;
                } else {
                    if ($write) {
                        DB::table('parking_rules')->insert($attributes);
                    }
                    $result['new_rules']++;
                }
            }

            return $result;
        });
    }

    /**
     * @param  list<array<string, ?string>>  $rows
     * @return array<string, array<string, ?string>>
     */
    private function index(array $rows): array
    {
        $indexed = [];
        foreach ($rows as $row) {
            if (! isset($row['id']) || isset($indexed[$row['id']])) {
                throw new InvalidArgumentException('Missing or duplicate legacy ID.');
            }
            $indexed[$row['id']] = $row;
        }

        return $indexed;
    }

    /**
     * @param  array<string, ?string>  $row
     * @param  array<string, array<string, ?string>>  $countries
     * @param  array<string, array<string, ?string>>  $provinces
     * @return array{country: array<string, ?string>, province: ?array<string, ?string>, municipality: ?string}
     */
    private function area(array $row, array $countries, array $provinces): array
    {
        $country = $countries[$row['country_id']] ?? null;
        if ($country === null || ! preg_match('/^[A-Z]{2}$/D', $country['code'] ?? '')) {
            throw new InvalidArgumentException('Missing or invalid legacy country.');
        }
        $province = $row['province_id'] === null ? null : ($provinces[$row['province_id']] ?? null);
        if ($row['province_id'] !== null && ($province === null || $province['country_id'] !== $row['country_id'])) {
            throw new InvalidArgumentException('Legacy province does not belong to its country.');
        }
        if ($province !== null && (empty($province['geocode']) || ! str_starts_with($province['geocode'], $country['code'].'-'))) {
            throw new InvalidArgumentException('Invalid legacy province code.');
        }

        return ['country' => $country, 'province' => $province, 'municipality' => $province === null ? null : trim($row['municipality'])];
    }

    /**
     * @param  array{country: array<string, ?string>, province: ?array<string, ?string>, municipality: ?string}  $area
     * @param  list<array<string, mixed>>  $countries
     * @param  list<array<string, mixed>>  $provinces
     * @param  list<array<string, mixed>>  $municipalities
     * @param  array<string, int>  $result
     * @return array{country_id: int, province_id: ?int, municipality_id: ?int}
     */
    private function resolve(array $area, array &$countries, array &$provinces, array &$municipalities, bool $write, array &$result): array
    {
        $countryId = $this->reference('countries', ['code' => $area['country']['code']], ['name' => $area['country']['name']], $countries, $write);
        if ($area['province'] === null) {
            return ['country_id' => $countryId, 'province_id' => null, 'municipality_id' => null];
        }
        $provinceId = $this->reference('provinces', ['country_id' => $countryId, 'geocode' => $area['province']['geocode']], ['name' => $area['province']['name']], $provinces, $write);
        $matches = array_values(array_filter($municipalities, fn ($row) => $row['country_id'] === $countryId && $row['province_id'] === $provinceId && $this->name($row['name']) === $this->name($area['municipality'])));
        if (count($matches) > 1) {
            throw new InvalidArgumentException('Ambiguous or conflicting municipality: '.$area['municipality'].'.');
        }
        if ($matches !== []) {
            $municipalityId = $matches[0]['id'];
        } else {
            $municipalityId = $this->reference('municipalities', ['country_id' => $countryId, 'province_id' => $provinceId, 'name' => $area['municipality']], [], $municipalities, $write);
            $result['municipalities']++;
        }

        return ['country_id' => $countryId, 'province_id' => $provinceId, 'municipality_id' => $municipalityId];
    }

    /**
     * @param  array<string, int|string>  $identity
     * @param  array<string, ?string>  $extra
     * @param  list<array<string, mixed>>  $known
     */
    private function reference(string $table, array $identity, array $extra, array &$known, bool $write): int
    {
        $matches = array_values(array_filter($known, fn ($row) => array_intersect_assoc($row, $identity) === $identity));
        if (count($matches) > 1) {
            throw new InvalidArgumentException('Ambiguous reference data in '.$table.'.');
        }
        if ($matches !== []) {
            return $matches[0]['id'];
        }
        $attributes = [...$identity, ...$extra, 'created_at' => now(), 'updated_at' => now()];
        $id = $write ? DB::table($table)->insertGetId($attributes) : -count($known) - 1;
        $known[] = ['id' => $id, ...$attributes];

        return $id;
    }

    /**
     * @param  array<string, mixed>  $existing
     * @param  array<string, mixed>  $attributes
     */
    private function same(array $existing, array $attributes, string $kind): void
    {
        foreach ($attributes as $key => $value) {
            $actual = $existing[$key] ?? null;
            if (is_bool($value)) {
                $actual = (bool) $actual;
            }
            if (in_array($key, ['latitude', 'longitude'], true)) {
                $actual = sprintf('%.7f', (float) $actual);
            }
            if ($actual !== $value) {
                throw new InvalidArgumentException('An existing '.$kind.' differs from the export; nothing will be overwritten.');
            }
        }
    }

    /**
     * @param  array<string, ?string>  $row
     * @param  array<string, list<string>>  $rules
     */
    private function validate(array $row, array $rules, string $table): void
    {
        $validator = Validator::make($row, $rules);
        if ($validator->fails()) {
            throw new InvalidArgumentException('Invalid legacy '.$table.' fields: '.implode(', ', array_keys($validator->errors()->messages())).'.');
        }
    }

    private function name(string $name): string
    {
        return mb_strtolower(trim(preg_replace('/^(gemeente|municipality|kommune|comune)\s+/iu', '', trim($name))));
    }
}
