<?php

namespace Database\Factories;

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Enums\UnderSign;
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
            'parking_time' => null,
            'orientation' => fake()->randomElement(ParkingOrientation::all()),
            'under_sign' => UnderSign::NO,
            'parking_disc' => false,
            'description' => fake()->optional()->sentence,
        ];
    }

    /**
     * A place with a sub-sign limiting parking to two hours on weekdays during the day.
     */
    public function withUnderSign(): static
    {
        return $this->state([
            'under_sign' => UnderSign::YES,
            'under_sign_text' => 'Ma-vr 09-18 h, max. 2 uur',
            'parking_time' => 120,
            'parking_disc' => true,
            'restriction_days' => ['mon', 'tue', 'wed', 'thu', 'fri'],
            'restriction_starts_at' => '09:00',
            'restriction_ends_at' => '18:00',
        ]);
    }
}
