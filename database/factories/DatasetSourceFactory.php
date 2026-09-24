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
    public function definition(): array
    {
        return [
            'code' => 'nl-amsterdam', 'name' => 'Amsterdam',
            'selection' => 'e6a-all', 'target_type' => 'municipal',
            'source_url' => 'https://api.data.amsterdam.nl/v1/parkeervakken/parkeervakken/',
            'attribution' => 'Gemeente Amsterdam — CC0',
            'terms_url' => 'https://data.overheid.nl/dataset/318a98b8-ef87-4335-9674-f5405f2bc4be',
            'municipality_id' => Municipality::factory()->state(['name' => 'Amsterdam'])->for(Province::factory()->state(['geocode' => 'NL-NH'])->for(Country::factory()->state(['code' => 'NL']))),
            'bounds' => [4.65, 52.2, 5.15, 52.5], 'publication_enabled' => true,
        ];
    }
}
