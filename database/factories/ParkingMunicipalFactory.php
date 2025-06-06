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
        return [
            'id' => $this->faker->unique()->bothify('##??##'),
            'country_id' => null,
            'province_id' => null,
            'municipality_id' => null,
            'street' => $this->faker->streetName,
            'orientation' => $this->faker->randomElement(ParkingOrientation::all()),
            'number' => $this->faker->numberBetween(1, 10),
            'longitude' => $this->faker->longitude,
            'latitude' => $this->faker->latitude,
            'visibility' => $this->faker->boolean,
        ];
    }
}
