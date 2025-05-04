<?php

namespace Database\Factories;

use App\Models\Country;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ParkingRule>
 */
class ParkingRuleFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'country_id' => function (): mixed {
                return Country::query()->inRandomOrder()->value('id') ?? Country::factory()->create()->id;
            },
            'municipality' => fake()->city,
            'url' => fake()->url,
            'nationwide' => fake()->boolean,
        ];
    }
}
