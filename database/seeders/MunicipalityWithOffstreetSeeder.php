<?php

namespace Database\Seeders;

use App\Models\Country;
use App\Models\Municipality;
use App\Models\ParkingOffstreet;
use App\Models\Province;
use Illuminate\Database\Seeder;

class MunicipalityWithOffstreetSeeder extends Seeder
{
    public function run(): void
    {
        $country = Country::firstOrCreate(['name' => 'Netherlands'], ['code' => 'NL']);
        $province = Province::firstOrCreate(
            ['name' => 'Noord-Holland', 'country_id' => $country->id]
        );

        $municipalities = ['Amsterdam', 'Haarlem', 'Alkmaar', 'Hilversum', 'Den Helder'];

        foreach ($municipalities as $municipalityName) {
            $municipality = Municipality::firstOrCreate([
                'name' => $municipalityName,
                'country_id' => $country->id,
                'province_id' => $province->id,
            ]);

            ParkingOffstreet::factory(3)->create([
                'country_id' => $country->id,
                'province_id' => $province->id,
                'municipality_id' => $municipality->id,
            ]);
        }
    }
}
