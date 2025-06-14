<?php

namespace Database\Factories;

use App\Enums\ApiState;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ParkingOffstreet>
 */
class ParkingOffstreetFactory extends Factory
{
    public function definition(): array
    {
        $short_capacity = fake()->numberBetween(80, 300);
        $long_capacity = fake()->optional()->numberBetween(20, 120);

        $free_space_short = fake()->numberBetween(0, $short_capacity);
        $free_space_long = is_null($long_capacity) ? null : fake()->numberBetween(0, $long_capacity);

        return [
            'id' => 'OFST_' . fake()->unique()->bothify('##??##'),

            'name' => fake()->company,
            'country_id' => null,
            'province_id' => null,
            'municipality_id' => null,

            // Parking details
            'free_space_short' => $free_space_short,
            'free_space_long' => $free_space_long,
            'short_capacity' => $short_capacity,
            'long_capacity' => $long_capacity,
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
