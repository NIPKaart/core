<?php

namespace Database\Factories;

use App\Models\Country;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Province>
 */
class ProvinceFactory extends Factory
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
            'name' => fake()->name(),
            'geocode' => strtoupper(fake()->bothify('??-##')),
        ];
    }
}
