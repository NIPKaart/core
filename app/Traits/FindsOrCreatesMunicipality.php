<?php

namespace App\Traits;

use App\Models\Municipality;

trait FindsOrCreatesMunicipality
{
    /**
     * Normalize the municipality name for matching.
     */
    protected function normalizeMunicipalityName(string $name): string
    {
        $prefixes = ['gemeente', 'municipality', 'kommune', 'comune'];
        $name = trim($name);
        foreach ($prefixes as $prefix) {
            $name = preg_replace('/^'.preg_quote($prefix, '/').'\s+/i', '', $name);
        }

        return strtolower($name);
    }

    /**
     * Find or create a municipality based on name, country, and province.
     */
    protected function findOrCreateMunicipality(string $name, int $countryId, int $provinceId): Municipality
    {
        $normalized = $this->normalizeMunicipalityName($name);

        // Try to find an existing municipality (case-insensitive match)
        $municipality = Municipality::where('country_id', $countryId)
            ->where('province_id', $provinceId)
            ->whereRaw('LOWER(TRIM(name)) = ?', [$normalized])
            ->first();

        if ($municipality) {
            return $municipality;
        }

        // If not found, create new (always save original name for display)
        return Municipality::create([
            'name' => trim($name),
            'country_id' => $countryId,
            'province_id' => $provinceId,
        ]);
    }
}
