<?php

namespace Database\Factories;

use App\Enums\ParkingOrientation;
use App\Models\Country;
use App\Models\Municipality;
use App\Models\Province;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ParkingMunicipal>
 */
class ParkingMunicipalFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        // Determine if there is already a country, otherwise create one
        $country = Country::query()->inRandomOrder()->first() ?? Country::factory()->create();

        // Determine if there is already a province for the country, otherwise create one
        $province = Province::where('country_id', $country->id)
            ->inRandomOrder()
            ->first()
            ?? Province::factory()->create(['country_id' => $country->id]);

        // Determine if there is already a municipality, otherwise create one
        $municipality = Municipality::where('country_id', $country->id)
            ->where('province_id', $province->id)
            ->inRandomOrder()
            ->first()
            ?? Municipality::factory()->create([
                'country_id' => $country->id,
                'province_id' => $province->id,
                'name' => $this->faker->city,
            ]);

        return [
            'id' => fake()->unique()->bothify('##??##'),
            'country_id' => $country->id,
            'province_id' => $province->id,
            'municipality_id' => $municipality->id,
            'street' => fake()->streetName,
            'orientation' => fake()->randomElement(ParkingOrientation::all()),
            'number' => fake()->numberBetween(1, 10),
            'longitude' => fake()->longitude,
            'latitude' => fake()->latitude,
            'visibility' => fake()->boolean,
        ];
    }
}
