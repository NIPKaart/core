<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ParkingOffstreet>
 */
class ParkingOffstreetFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'OFST_' . $this->faker->unique()->bothify('##??##'),

            'name' => $this->faker->company,
            'country_id' => null,
            'province_id' => null,
            'municipality_id' => null,

            // Parking details
            'free_space_short' => $this->faker->numberBetween(0, 200),
            'free_space_long' => $this->faker->optional()->numberBetween(0, 100),
            'short_capacity' => $this->faker->numberBetween(80, 300),
            'long_capacity' => $this->faker->optional()->numberBetween(20, 120),
            'availability_pct' => $this->faker->optional()->randomFloat(2, 0, 1),
            'parking_type' => $this->faker->randomElement(['garage', 'parkandride']),
            'prices' => [
                'short' => $this->faker->randomFloat(2, 0, 10),
                'long' => $this->faker->optional()->randomFloat(2, 0, 20),
            ],
            'url' => $this->faker->optional()->url,
            'visibility' => $this->faker->boolean(80),

            // Parking location
            'longitude' => $this->faker->longitude,
            'latitude' => $this->faker->latitude,
        ];
    }
}
