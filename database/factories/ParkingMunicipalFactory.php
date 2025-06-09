<?php

namespace Database\Factories;

use App\Enums\ParkingOrientation;
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
        return [
            'id' => 'MUNI_' . $this->faker->unique()->bothify('##??##'),
            'country_id' => null,
            'province_id' => null,
            'municipality_id' => null,

            // Parking details
            'street' => $this->faker->streetName,
            'orientation' => $this->faker->randomElement(ParkingOrientation::all()),
            'number' => $this->faker->numberBetween(1, 10),
            'visibility' => $this->faker->boolean(80),

            // Parking location
            'longitude' => $this->faker->longitude,
            'latitude' => $this->faker->latitude,
        ];
    }
}
