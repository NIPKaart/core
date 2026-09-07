<?php

namespace Database\Factories;

use App\Models\Municipality;
use App\Models\Province;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Municipality>
 */
class MunicipalityFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => $this->faker->city,
            'province_id' => Province::factory(),
            'country_id' => fn (array $attributes) => Province::findOrFail($attributes['province_id'])->country_id,
        ];
    }
}
