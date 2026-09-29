<?php

namespace App\Services;

use App\Models\Country;
use App\Models\Province;
use App\Traits\FindsOrCreatesMunicipality;
use App\Traits\FindsOrCreatesProvince;
use App\Traits\ParsesNominatimAddress;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Resolves where a contributed parking place lies, server-side, following ADR 0012's provider rules.
 *
 * Geoapify reverse geocoding is tried first and public Nominatim is the rate-limited fallback. Results are
 * cached per ~1 m coordinate for a day. Looking up never writes; only attributesFor() creates a province or
 * municipality seen for the first time.
 */
final class ParkingLocationResolver
{
    use FindsOrCreatesMunicipality;
    use FindsOrCreatesProvince;
    use ParsesNominatimAddress;

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

        $address = $this->fromGeoapify($latitude, $longitude) ?? $this->fromNominatim($latitude, $longitude);
        if ($address !== null) {
            Cache::put($cacheKey, $address, now()->addDay());
        }

        return $address;
    }

    /**
     * @return array<string, string>|null
     */
    private function fromGeoapify(float $latitude, float $longitude): ?array
    {
        $key = config('services.geoapify.key');
        if (! is_string($key) || $key === '') {
            return null;
        }

        try {
            $result = Http::timeout(3)->retry(1, 100)->get('https://api.geoapify.com/v1/geocode/reverse', [
                'lat' => $latitude,
                'lon' => $longitude,
                'format' => 'json',
                'apiKey' => $key,
            ])->throw()->json('results.0');
        } catch (ConnectionException|RequestException $exception) {
            Log::warning('Reverse geocoding provider request failed.', ['provider' => 'geoapify', 'exception' => $exception::class]);

            return null;
        }

        if (! is_array($result) || empty($result['country_code'])) {
            return null;
        }

        return array_filter([
            'country_code' => $result['country_code'],
            'state' => $result['state'] ?? null,
            'ISO3166-2-lvl4' => isset($result['state_code']) ? strtoupper($result['country_code']).'-'.$result['state_code'] : null,
            'municipality' => $result['municipality'] ?? null,
            'city' => $result['city'] ?? null,
            'village' => $result['village'] ?? null,
            'county' => $result['county'] ?? null,
            'suburb' => $result['suburb'] ?? null,
            'neighbourhood' => $result['district'] ?? null,
            'road' => $result['street'] ?? null,
            'postcode' => $result['postcode'] ?? null,
        ], fn (mixed $value): bool => is_string($value) && $value !== '');
    }

    /**
     * @return array<string, string>|null
     */
    private function fromNominatim(float $latitude, float $longitude): ?array
    {
        if (! config('services.nominatim.enabled', true) || RateLimiter::tooManyAttempts('nominatim-public', 1)) {
            return null;
        }

        RateLimiter::hit('nominatim-public', 1);

        try {
            $address = Http::withHeaders([
                'User-Agent' => config('services.nominatim.user_agent'),
                'Accept-Language' => app()->getLocale(),
            ])->timeout(3)->get('https://nominatim.openstreetmap.org/reverse', [
                'lat' => $latitude,
                'lon' => $longitude,
                'format' => 'jsonv2',
                'addressdetails' => 1,
                'zoom' => 18,
            ])->throw()->json('address');
        } catch (ConnectionException|RequestException $exception) {
            Log::warning('Reverse geocoding provider request failed.', ['provider' => 'nominatim', 'exception' => $exception::class]);

            return null;
        }

        return is_array($address) && ! empty($address['country_code']) ? array_map('strval', $address) : null;
    }
}
