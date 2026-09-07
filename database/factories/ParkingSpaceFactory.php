<?php

namespace Database\Factories;

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Models\Municipality;
use App\Models\ParkingSpace;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Str;

/**
 * @extends Factory<ParkingSpace>
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
            'municipality_id' => Municipality::factory(),
            'province_id' => fn (array $attributes) => Municipality::findOrFail($attributes['municipality_id'])->province_id,
            'country_id' => fn (array $attributes) => Municipality::findOrFail($attributes['municipality_id'])->country_id,
            'city' => fake()->city,
            'suburb' => fake()->optional()->citySuffix,
            'neighbourhood' => fake()->optional()->word,
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
