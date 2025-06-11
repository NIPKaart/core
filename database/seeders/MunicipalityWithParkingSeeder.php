<?php

namespace Database\Seeders;

use App\Models\Country;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\Province;
use Illuminate\Database\Seeder;

class MunicipalityWithParkingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $country = Country::firstOrCreate(['name' => 'Netherlands'], ['code' => 'NL']);
        $province = Province::firstOrCreate(
            ['name' => 'Noord-Holland', 'country_id' => $country->id]
        );

        $municipalities = ['Amsterdam', 'Haarlem', 'Alkmaar', 'Hilversum', 'Den Helder'];

        foreach ($municipalities as $municipality) {
            $municipality = Municipality::firstOrCreate([
                'name' => $municipality,
                'country_id' => $country->id,
                'province_id' => $province->id,
            ]);

            ParkingMunicipal::factory(5)->create([
                'country_id' => $country->id,
                'province_id' => $province->id,
                'municipality_id' => $municipality->id,
            ]);
        }
    }
}
