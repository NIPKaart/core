<?php

namespace Database\Factories;

use App\Models\Country;
use App\Models\Province;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ParkingOffstreet>
 */
class ParkingOffstreetFactory extends Factory
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
            'name' => fake()->company,
            'country_id' => function (): mixed {
                return Country::query()->inRandomOrder()->value('id') ?? Country::factory()->create()->id;
            },
            'province_id' => function (): mixed {
                $countryId = Country::query()->inRandomOrder()->value('id') ?? Country::factory()->create()->id;

                return Province::where('country_id', $countryId)
                    ->inRandomOrder()
                    ->value('id')
                    ?? Province::factory()->create(['country_id' => $countryId])->id;
            },
            'municipality' => fake()->city,
            'state' => fake()->optional()->state,
            'free_space_short' => fake()->numberBetween(0, 100),
            'free_space_long' => fake()->optional()->numberBetween(0, 50),
            'short_capacity' => fake()->numberBetween(100, 200),
            'long_capacity' => fake()->optional()->numberBetween(50, 150),
            'availability_pct' => fake()->optional()->randomFloat(2, 0, 1),
            'parking_type' => fake()->randomElement(['garage', 'parkandride']),
            'prices' => json_encode(['short' => fake()->randomFloat(2, 0, 10)]),
            'url' => fake()->optional()->url,
            'longitude' => fake()->longitude,
            'latitude' => fake()->latitude,
            'visibility' => fake()->boolean,
        ];
    }
}
