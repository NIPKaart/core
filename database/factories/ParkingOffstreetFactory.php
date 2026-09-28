<?php

namespace Database\Factories;

use App\Enums\ApiState;
use App\Models\Municipality;
use App\Models\ParkingOffstreet;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ParkingOffstreet>
 */
class ParkingOffstreetFactory extends Factory
{
    public function definition(): array
    {
        $capacity = fake()->numberBetween(80, 300);

        return [
            'id' => 'OFST_'.fake()->unique()->bothify('##??##'),

            'name' => fake()->company,
            'municipality_id' => Municipality::factory(),
            'province_id' => fn (array $attributes) => Municipality::findOrFail($attributes['municipality_id'])->province_id,
            'country_id' => fn (array $attributes) => Municipality::findOrFail($attributes['municipality_id'])->country_id,

            // Parking details
            'free_space' => fake()->numberBetween(0, $capacity),
            'capacity' => $capacity,
            'occupancy_status' => 'counting',
            'parking_type' => fake()->randomElement(['garage', 'parkandride']),
            'prices' => [
                'short' => fake()->randomFloat(2, 0, 10),
                'long' => fake()->optional()->randomFloat(2, 0, 20),
            ],
            'url' => fake()->optional()->url,
            'api_state' => fake()->randomElement(ApiState::all()),
            'visibility' => fake()->boolean(80),

            // Parking location
            'longitude' => fake()->longitude,
            'latitude' => fake()->latitude,
        ];
    }
}
