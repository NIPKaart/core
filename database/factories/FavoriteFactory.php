<?php

namespace Database\Factories;

use App\Models\Favorite;
use App\Models\ParkingSpace;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Favorite> */
class FavoriteFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'favoritable_type' => (new ParkingSpace)->getMorphClass(),
            'favoritable_id' => ParkingSpace::factory(),
        ];
    }
}
