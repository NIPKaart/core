<?php

namespace App\Traits;

trait ParsesNominatimAddress
{
    protected function getStreet(array $data): string
    {
        return $data['road'] ?? $data['street'] ?? 'unknown';
    }

    protected function getMunicipality(array $data): string
    {
        return $data['municipality']
            ?? $data['city']
            ?? $data['town']
            ?? $data['village']
            ?? 'unknown';
    }

    protected function getCity(array $data): string
    {
        return $data['city']
            ?? $data['city_district']
            ?? $data['village']
            ?? $data['town']
            ?? $data['municipality']
            ?? 'unknown';
    }

    protected function getSuburb(array $data): ?string
    {
        return $data['suburb'] ?? $data['hamlet'] ?? null;
    }

    protected function getNeighbourhood(array $data): ?string
    {
        return $data['neighbourhood'] ?? $data['quarter'] ?? null;
    }

    protected function getAmenity(array $data): ?string
    {
        return $data['amenity']
            ?? $data['building']
            ?? $data['tourism']
            ?? $data['shop']
            ?? $data['leisure']
            ?? $data['military']
            ?? $data['industrial']
            ?? $data['residential']
            ?? null;
    }
}
