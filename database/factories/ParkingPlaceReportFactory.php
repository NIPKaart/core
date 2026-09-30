<?php

namespace Database\Factories;

use App\Models\ParkingMunicipal;
use App\Models\ParkingPlaceReport;
use App\Models\ParkingSpace;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ParkingPlaceReport> */
class ParkingPlaceReportFactory extends Factory
{
    public function definition(): array
    {
        return [
            'parking_space_id' => ParkingSpace::factory(),
            'user_id' => User::factory(),
            'note' => null,
        ];
    }

    /**
     * Report a municipal parking place instead of a community one.
     */
    public function municipal(): static
    {
        return $this->state([
            'parking_space_id' => null,
            'parking_municipal_id' => ParkingMunicipal::factory(),
        ]);
    }
}
