<?php

namespace App\Contracts;

interface ReverseGeocoder
{
    /**
     * Describe what lies at a coordinate, or null when the provider has no answer for it.
     *
     * Components use Nominatim's address keys (country_code, state, ISO3166-2-lvl4, municipality, city, road, postcode, suburb, neighbourhood).
     *
     * @return array<string, string>|null
     */
    public function reverse(float $latitude, float $longitude): ?array;
}
