<?php

namespace Database\Factories;

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Models\Country;
use App\Models\Province;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ParkingSpace>
 */
class ParkingSpaceFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'user_id' => function (): mixed {
                return User::inRandomOrder()->first()->id ?? User::factory()->create()->id;
            },
            'status' => fake()->randomElement(ParkingStatus::all()),
            'ip_address' => fake()->ipv4(),
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
            'city' => fake()->city,
            'suburb' => fake()->optional()->citySuffix,
            'neighborhood' => fake()->optional()->word,
            'postcode' => fake()->postcode,
            'street' => fake()->streetName,
            'amenity' => fake()->optional()->word,
            'longitude' => fake()->longitude,
            'latitude' => fake()->latitude,
            'parking_time' => fake()->optional()->numberBetween(30, 300),
            'orientation' => fake()->randomElement(ParkingOrientation::all()),
            'parking_disc' => fake()->boolean,
            'window_times' => fake()->boolean,
            'description' => fake()->optional()->sentence,
        ];
    }
}
