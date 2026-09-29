<?php

namespace App\Services;

use App\Contracts\DestinationGeocoder;
use App\Contracts\ReverseGeocoder;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class GeoapifyDestinationGeocoder implements DestinationGeocoder, ReverseGeocoder
{
    public function autocomplete(string $query, int $limit = 5): array
    {
        return $this->request('autocomplete', $query, $limit);
    }

    public function resolve(string $query): ?array
    {
        return $this->request('search', $query, 1)[0] ?? null;
    }

    public function reverse(float $latitude, float $longitude): ?array
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

    private function request(string $endpoint, string $query, int $limit): array
    {
        $key = config('services.geoapify.key');
        if (! is_string($key) || $key === '') {
            return [];
        }

        $query = trim($query);
        $limit = max(1, min(10, $limit));
        $cacheKey = 'destination:geoapify:'.sha1($endpoint.'|'.$query.'|'.$limit);

        try {
            return Cache::remember($cacheKey, now()->addDay(), function () use ($endpoint, $query, $limit, $key): array {
                $response = Http::timeout(3)->retry(1, 100)->get("https://api.geoapify.com/v1/geocode/{$endpoint}", [
                    'text' => $query,
                    'limit' => $limit,
                    'format' => 'json',
                    'apiKey' => $key,
                ])->throw();

                return collect($response->json('results', []))->map(fn (array $item): ?array => $this->normalize($item))
                    ->filter()->values()->all();
            });
        } catch (ConnectionException|RequestException $exception) {
            Log::warning('Destination provider request failed.', ['provider' => 'geoapify', 'exception' => $exception::class]);

            return [];
        }
    }

    private function normalize(array $item): ?array
    {
        if (! isset($item['lat'], $item['lon'])) {
            return null;
        }

        return [
            'key' => 'geoapify:'.($item['place_id'] ?? sha1(json_encode([$item['lat'], $item['lon'], $item['formatted'] ?? '']))),
            'label' => (string) ($item['name'] ?? $item['address_line1'] ?? $item['formatted'] ?? ''),
            'sub' => $item['address_line2'] ?? $item['formatted'] ?? null,
            'type' => (string) ($item['result_type'] ?? 'destination'),
            'latitude' => (float) $item['lat'],
            'longitude' => (float) $item['lon'],
        ];
    }
}
