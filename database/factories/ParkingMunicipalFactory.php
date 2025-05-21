<?php

namespace Database\Factories;

use App\Enums\ParkingOrientation;
use App\Models\Country;
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
            'id' => fake()->unique()->bothify('##??##'),
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
            'street' => fake()->streetName,
            'orientation' => fake()->randomElement(ParkingOrientation::all()),
            'number' => fake()->numberBetween(1, 10),
            'longitude' => fake()->longitude,
            'latitude' => fake()->latitude,
            'visibility' => fake()->boolean,
        ];
    }
}
