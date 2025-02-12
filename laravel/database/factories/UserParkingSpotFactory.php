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
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\UserParkingSpot>
 */
class UserParkingSpotFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id'            => (string) Str::uuid(),
            'user_id'       => User::factory(),
            'status'        => fake()->randomElement(ParkingStatus::toArray()),
            'ip_address'    => fake()->ipv4(),
            'country_id'    => Country::factory(),
            'province_id'   => Province::factory(),
            'municipality'  => fake()->city,
            'city'          => fake()->city,
            'suburb'        => fake()->optional()->citySuffix,
            'neighbourhood' => fake()->optional()->word,
            'postcode'      => fake()->postcode,
            'street'        => fake()->streetName,
            'amenity'       => fake()->optional()->word,
            'longitude'     => fake()->longitude,
            'latitude'      => fake()->latitude,
            'parking_time'  => fake()->optional()->numberBetween(30, 300),
            'orientation'   => fake()->randomElement(ParkingOrientation::toArray()),
            'parking_disc'  => fake()->boolean,
            'window_times'  => fake()->boolean,
            'description'   => fake()->optional()->sentence,
        ];
    }
}
