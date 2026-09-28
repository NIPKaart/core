<?php

namespace Database\Factories;

use App\Models\Country;
use App\Models\DatasetSource;
use App\Models\Municipality;
use App\Models\Province;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<DatasetSource> */
class DatasetSourceFactory extends Factory
{
    /**
     * The `source` block the municipal collector sends for Amsterdam (ADR 0013).
     *
     * @return array<string, mixed>
     */
    public static function municipalDescription(array $overrides = []): array
    {
        return array_replace([
            'name' => 'Amsterdam algemene gehandicaptenparkeerplaatsen', 'publisher' => 'Gemeente Amsterdam',
            'source_url' => 'https://api.data.amsterdam.nl/v1/parkeervakken/parkeervakken/', 'licence' => 'CC0-1.0',
            'terms_url' => 'https://data.overheid.nl/dataset/318a98b8-ef87-4335-9674-f5405f2bc4be',
            'attribution' => 'Gemeente Amsterdam; parkeervakken E6a; capaciteit is een schatting.',
            'area' => ['country' => 'NL', 'subdivision' => 'NL-NH', 'municipality' => ['scheme' => 'nl-cbs', 'code' => 'GM0363', 'name' => 'Amsterdam']],
            'bounds' => [4.65, 52.2, 5.15, 52.5], 'expected_interval_hours' => 24,
        ], $overrides);
    }

    /**
     * The `source` block the offstreet collector sends for the Amsterdam garage and P+R catalog.
     *
     * @return array<string, mixed>
     */
    public static function offstreetDescription(array $overrides = []): array
    {
        return self::municipalDescription([
            'name' => 'Amsterdam parkeergarages en P+R', 'licence' => 'CC-BY-4.0',
            'source_url' => 'https://p-info.vorin-amsterdam.nl/v1/ParkingLocation.json',
            'terms_url' => 'https://data.overheid.nl/dataset/9orkef6t-au29g',
            'attribution' => 'Gemeente Amsterdam; Actuele beschikbaarheid Parkeergarages; CC-BY 4.0.',
            ...$overrides,
        ]);
    }

    public function definition(): array
    {
        return [
            'code' => 'nl-amsterdam', 'selection' => 'e6a-all', 'target_type' => 'municipal',
            ...DatasetSource::attributesFromDescription(self::municipalDescription()),
            'municipality_id' => Municipality::factory()->state(['name' => 'Amsterdam', 'code_scheme' => 'nl-cbs', 'code' => 'GM0363'])
                ->for(Province::factory()->state(['geocode' => 'NL-NH'])->for(Country::factory()->state(['code' => 'NL']))),
            'approval_state' => 'approved',
        ];
    }

    /** The Amsterdam garage and P+R catalog delivered by the offstreet collector. */
    public function offstreet(): static
    {
        return $this->state([
            'code' => 'nl-amsterdam-garages', 'selection' => 'car-garages-and-pr', 'target_type' => 'offstreet',
            ...DatasetSource::attributesFromDescription(self::offstreetDescription()),
        ]);
    }

    /** A source discovered in the bucket that no administrator approved yet. */
    public function pending(): static
    {
        return $this->state(['approval_state' => 'pending']);
    }
}
