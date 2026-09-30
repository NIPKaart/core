<?php

namespace Database\Factories;

use App\Enums\RemovalAction;
use App\Enums\RemovalReason;
use App\Models\ParkingPlaceRemoval;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<ParkingPlaceRemoval> */
class ParkingPlaceRemovalFactory extends Factory
{
    public function definition(): array
    {
        return [
            'source' => 'community',
            'place_id' => (string) Str::uuid(),
            'place_label' => fake()->streetName(),
            'action' => RemovalAction::DELETED,
            'reason' => RemovalReason::NO_LONGER_EXISTS,
            'note' => null,
            'open_reports' => 1,
            'removed_by' => User::factory(),
            'removed_at' => now(),
        ];
    }
}
