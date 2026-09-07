<?php

namespace Database\Factories;

use App\Enums\ParkingConfirmationStatus;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceConfirmation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ParkingSpaceConfirmation> */
class ParkingSpaceConfirmationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'parking_space_id' => ParkingSpace::factory(),
            'user_id' => User::factory(),
            'confirmed_at' => now(),
            'status' => ParkingConfirmationStatus::CONFIRMED,
            'comment' => null,
        ];
    }
}
