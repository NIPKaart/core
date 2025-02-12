<?php

namespace Database\Seeders;

use App\Models\UserParkingSpot;
use Illuminate\Database\Seeder;

class UserParkingSpotSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create 10 parking spots that users could add
        UserParkingSpot::factory()->count(10)->create();
    }
}
