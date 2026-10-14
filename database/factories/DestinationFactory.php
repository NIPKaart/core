<?php

namespace Database\Factories;

use App\Models\Destination;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Destination> */
class DestinationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'label' => fake()->word(),
            'key' => 'destination:'.fake()->uuid(),
            'name' => fake()->address(),
            'sub' => null,
            'type' => 'address',
            'latitude' => 52.36,
            'longitude' => 4.88,
        ];
    }
}
