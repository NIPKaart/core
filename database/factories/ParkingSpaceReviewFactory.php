<?php

namespace Database\Factories;

use App\Enums\ParkingStatus;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceReview;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ParkingSpaceReview>
 */
class ParkingSpaceReviewFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'parking_space_id' => ParkingSpace::factory(),
            'reviewed_by' => User::factory(),
            'from_status' => ParkingStatus::PENDING,
            'to_status' => ParkingStatus::APPROVED,
            'reviewed_at' => now(),
        ];
    }
}
