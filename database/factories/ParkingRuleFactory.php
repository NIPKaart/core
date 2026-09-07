<?php

namespace Database\Factories;

use App\Models\Country;
use App\Models\Municipality;
use App\Models\ParkingRule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ParkingRule>
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
            'municipality_id' => Municipality::factory(),
            'country_id' => fn (array $attributes) => Municipality::findOrFail($attributes['municipality_id'])->country_id,
            'url' => "https://{$this->slugify($municipality)}.gov.example/parking-rules",
            'nationwide' => false,
        ];
    }

    public function nationwide(): static
    {
        return $this->state(fn () => [
            'country_id' => Country::factory(),
            'municipality_id' => null,
            'nationwide' => true,
        ]);
    }

    protected function slugify(string $value): string
    {
        return strtolower(preg_replace('/\s+/', '-', $value));
    }
}
