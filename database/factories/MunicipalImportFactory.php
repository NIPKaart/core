<?php

namespace Database\Factories;

use App\Models\DatasetSource;
use App\Models\MunicipalImport;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<MunicipalImport> */
class MunicipalImportFactory extends Factory
{
    public function definition(): array
    {
        return [
            'dataset_source_id' => DatasetSource::factory(), 'delivery_id' => fake()->uuid(),
            'fingerprint' => hash('sha256', 'example'), 'retrieved_at' => now()->subMinute(),
            'dataset_config' => fn (array $attributes) => DatasetSource::findOrFail($attributes['dataset_source_id'])->configuration(),
            'records' => [],
        ];
    }
}
