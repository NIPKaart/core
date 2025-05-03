<?php

namespace Database\Seeders;

use App\Models\Province;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Seeder;

class ProvinceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('provinces')->delete();

        $provinces = [
            ['country_id' => 157, 'name' => 'Groningen', 'geocode' => 'NL-GR'],
            ['country_id' => 157, 'name' => 'Fryslân', 'geocode' => 'NL-FR'],
            ['country_id' => 157, 'name' => 'Drenthe', 'geocode' => 'NL-DR'],
            ['country_id' => 157, 'name' => 'Overijssel', 'geocode' => 'NL-OV'],
            ['country_id' => 157, 'name' => 'Flevoland', 'geocode' => 'NL-FL'],
            ['country_id' => 157, 'name' => 'Gelderland', 'geocode' => 'NL-GE'],
            ['country_id' => 157, 'name' => 'Utrecht', 'geocode' => 'NL-UT'],
            ['country_id' => 157, 'name' => 'Noord-Holland', 'geocode' => 'NL-NH'],
            ['country_id' => 157, 'name' => 'Zuid-Holland', 'geocode' => 'NL-ZH'],
            ['country_id' => 157, 'name' => 'Zeeland', 'geocode' => 'NL-ZE'],
            ['country_id' => 157, 'name' => 'Noord-Brabant', 'geocode' => 'NL-NB'],
            ['country_id' => 157, 'name' => 'Limburg', 'geocode' => 'NL-LI'],
        ];

        foreach ($provinces as $key => $value) {
            Province::create($value);
        }
    }
}
