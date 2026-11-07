<?php

namespace App\Services;

use App\Models\Country;
use Illuminate\Support\Facades\DB;

class GeographicReferenceCatalog
{
    public function sync(): void
    {
        DB::transaction(function (): void {
            foreach (config('geographic-reference.countries') as $code => $entry) {
                $country = Country::firstOrCreate(['code' => $code], ['name' => $entry['name']]);

                foreach ($entry['subdivisions'] as $geocode => $name) {
                    $country->provinces()->firstOrCreate(['geocode' => $geocode], ['name' => $name]);
                }
            }
        });
    }
}
