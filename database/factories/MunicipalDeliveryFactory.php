<?php

namespace Database\Factories;

use App\Models\DatasetSource;
use App\Models\MunicipalDelivery;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<MunicipalDelivery> */
class MunicipalDeliveryFactory extends Factory
{
    public function definition(): array
    {
        return [
            'dataset_source_id' => DatasetSource::factory(),
            'bucket' => 'municipal-test',
            'object_key' => 'municipal/nl-amsterdam-parkeervakken-e6a/'.fake()->uuid().'.json',
            'etag' => '"test-etag"',
        ];
    }
}
