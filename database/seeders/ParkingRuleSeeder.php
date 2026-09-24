<?php

namespace Database\Seeders;

use App\Models\ParkingRule;
use Illuminate\Database\Seeder;

class ParkingRuleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        ParkingRule::factory()->count(30)->create();
    }
}
