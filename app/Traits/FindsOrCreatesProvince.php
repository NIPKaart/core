<?php

namespace App\Traits;

use App\Models\Province;

trait FindsOrCreatesProvince
{
    /**
     * Find or create a province based on name, country, and (optionally) geocode.
     */
    public function findOrCreateProvince(string $name, int $countryId, ?string $geocode = null): Province
    {
        // Trim the name to avoid issues with leading/trailing spaces
        if ($geocode) {
            $province = Province::where('country_id', $countryId)
                ->where('geocode', $geocode)
                ->first();
            if ($province) {
                return $province;
            }
        }

        // Fallback: search by name (case-insensitive)
        $province = Province::where('country_id', $countryId)
            ->whereRaw('LOWER(name) = ?', [strtolower(trim($name))])
            ->first();

        if ($province) {
            return $province;
        }

        // Not found, create a new province
        return Province::create([
            'country_id' => $countryId,
            'name' => trim($name),
            'geocode' => $geocode,
        ]);
    }
}
