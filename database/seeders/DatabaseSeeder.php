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
            PermissionsTableSeeder::class,
            CountrySeeder::class,
            ProvinceSeeder::class,
            UserTableSeeder::class,

            MunicipalityWithParkingSeeder::class,
            MunicipalityWithOffstreetSeeder::class,
        ]);
    }
}
