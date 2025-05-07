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
        $municipality = fake()->city();

        return [
            'country_id' => fn () => Country::query()->inRandomOrder()->value('id') ?? Country::factory()->create()->id,
            'municipality' => $municipality,
            'url' => "https://{$this->slugify($municipality)}.gov.example/parking-rules",
            'nationwide' => fake()->boolean,
        ];
    }

    protected function slugify(string $value): string
    {
        return strtolower(preg_replace('/\s+/', '-', $value));
    }
}
