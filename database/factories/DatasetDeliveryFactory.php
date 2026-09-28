<?php

namespace Database\Factories;

use App\Models\DatasetDelivery;
use App\Models\DatasetSource;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<DatasetDelivery> */
class DatasetDeliveryFactory extends Factory
{
    public function definition(): array
    {
        return [
            'dataset_source_id' => DatasetSource::factory(),
            'bucket' => 'municipal-test',
            'object_key' => 'municipal/nl-amsterdam/'.fake()->uuid().'.json',
            'etag' => '"test-etag"',
        ];
    }
}
