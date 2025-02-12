<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            ShieldSeeder::class,
            CountrySeeder::class,
            // ProvinceSeeder::class,

            UserSeeder::class,
            UserParkingSpotSeeder::class,
        ]);
    }
}
