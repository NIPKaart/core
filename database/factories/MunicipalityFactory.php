<?php

namespace Database\Factories;

use App\Models\Country;
use App\Models\Province;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Municipality>
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
        // Pick a random country, or create one
        $country = Country::query()->inRandomOrder()->first() ?? Country::factory()->create();

        // Pick a random province for the country, or create one
        $province = Province::where('country_id', $country->id)
            ->inRandomOrder()
            ->first()
            ?? Province::factory()->create(['country_id' => $country->id]);

        return [
            'name' => $this->faker->city,
            'country_id' => $country->id,
            'province_id' => $province->id,
        ];
    }
}
