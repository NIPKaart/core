<?php

namespace Database\Seeders;

use App\Models\Country;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class StockholmReferenceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::transaction(function (): void {
            $country = Country::firstOrCreate(['code' => 'SE'], ['name' => 'Sweden']);
            $country->provinces()->firstOrCreate(['geocode' => 'SE-AB'], ['name' => 'Stockholms län']);
        });
    }
}
