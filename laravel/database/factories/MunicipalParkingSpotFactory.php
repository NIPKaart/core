<?php

namespace Database\Factories;

use App\Enums\ParkingOrientation;
use App\Models\Country;
use App\Models\Province;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\MunicipalParkingSpot>
 */
class MunicipalParkingSpotFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => fake()->unique()->bothify('##??##'),
            'country_id' => Country::factory(),
            'province_id' => Province::factory(),
            'municipality' => fake()->city,
            'street' => fake()->streetName,
            'orientation' => fake()->randomElement(ParkingOrientation::toArray()),
            'number' => fake()->numberBetween(1, 10),
            'longitude' => fake()->longitude,
            'latitude' => fake()->latitude,
            'visibility' => fake()->boolean,
        ];
    }
}
