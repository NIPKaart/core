<?php

namespace App\Services;

use App\Contracts\ReverseGeocoder;
use App\Models\Country;
use App\Models\Province;
use App\Traits\FindsOrCreatesMunicipality;
use App\Traits\FindsOrCreatesProvince;
use App\Traits\ParsesNominatimAddress;
use Illuminate\Support\Facades\Cache;

/**
 * Resolves where a contributed parking place lies, server-side, following ADR 0012's provider rules.
 *
 * Providers are asked in the configured order (PDOK, Geoapify, then rate-limited public Nominatim). Results
 * are cached per ~1 m coordinate for a day. Looking up never writes; only attributesFor() creates a province or
 * municipality seen for the first time.
 */
final class ParkingLocationResolver
{
    use FindsOrCreatesMunicipality;
    use FindsOrCreatesProvince;
    use ParsesNominatimAddress;

    public function __construct(private ReverseGeocoder $geocoder) {}

    /**
     * Resolve the address at a pin, or null when it lies outside a supported country or has no municipality.
     *
     * @return array{country_id: int, country: string, province: ?string, municipality: string, street: ?string, address: array<string, string>}|null
     */
    public function lookup(float $latitude, float $longitude): ?array
    {
        $address = $this->reverse($latitude, $longitude);
        if ($address === null) {
            return null;
        }

        $country = Country::where('code', strtoupper($address['country_code'] ?? ''))->first();
        $municipality = $this->getMunicipality($address);
        if ($country === null || $municipality === 'unknown') {
            return null;
        }

        $street = $this->getStreet($address);
        $geocode = $address['ISO3166-2-lvl6'] ?? $address['ISO3166-2-lvl4'] ?? null;
        $knownProvince = $geocode ? Province::where('country_id', $country->id)->where('geocode', $geocode)->value('name') : null;

        return [
            'country_id' => $country->id,
            'country' => $country->name,
            'province' => $knownProvince ?? $address['state'] ?? null,
            'municipality' => trim($municipality),
            'street' => $street === 'unknown' ? null : $street,
            'address' => $address,
        ];
    }

    /**
     * ParkingSpace location attributes for a resolved pin, creating its province and municipality when first seen.
     *
     * @param  array{country_id: int, municipality: string, address: array<string, string>}  $location
     * @return array<string, int|string|null>
     */
    public function attributesFor(array $location): array
    {
        $address = $location['address'];
        $province = $this->findOrCreateProvince(
            $address['state'] ?? $location['municipality'],
            $location['country_id'],
            $address['ISO3166-2-lvl6'] ?? $address['ISO3166-2-lvl4'] ?? null,
        );
        $municipality = $this->findOrCreateMunicipality($location['municipality'], $location['country_id'], $province->id);

        return [
            'country_id' => $location['country_id'],
            'province_id' => $province->id,
            'municipality_id' => $municipality->id,
            'city' => $this->getCity($address),
            'suburb' => $this->getSuburb($address),
            'neighbourhood' => $this->getNeighbourhood($address),
            'postcode' => str_replace(' ', '', $address['postcode'] ?? ''),
            'street' => $this->getStreet($address),
            'amenity' => $this->getAmenity($address),
        ];
    }

    /**
     * @return array<string, string>|null Nominatim-style address components
     */
    private function reverse(float $latitude, float $longitude): ?array
    {
        $cacheKey = sprintf('parking-location:%.5f,%.5f', $latitude, $longitude);
        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }

        $address = $this->geocoder->reverse($latitude, $longitude);
        if ($address !== null) {
            Cache::put($cacheKey, $address, now()->addDay());
        }

        return $address;
    }
}
