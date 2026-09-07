<?php

namespace Database\Factories;

use App\Enums\ParkingOrientation;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ParkingMunicipal>
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
            'id' => 'MUNI_'.$this->faker->unique()->bothify('##??##'),
            'municipality_id' => Municipality::factory(),
            'province_id' => fn (array $attributes) => Municipality::findOrFail($attributes['municipality_id'])->province_id,
            'country_id' => fn (array $attributes) => Municipality::findOrFail($attributes['municipality_id'])->country_id,

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
