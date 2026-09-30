<?php

namespace Database\Factories;

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceImprovement;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ParkingSpaceImprovement> */
class ParkingSpaceImprovementFactory extends Factory
{
    public function definition(): array
    {
        return [
            'parking_space_id' => ParkingSpace::factory()->state(['status' => ParkingStatus::APPROVED]),
            'user_id' => User::factory(),
            'status' => ParkingStatus::PENDING,
            'submitted' => ['orientation' => fake()->randomElement(ParkingOrientation::all())],
        ];
    }
}
