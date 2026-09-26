<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;

final class NominatimDestinationResolver
{
    /** @return array{key: string, label: string, sub: ?string, type: string, latitude: float, longitude: float}|null */
    public function resolve(string $query): ?array
    {
        if (! config('services.nominatim.enabled', true)) {
            return null;
        }

        $query = trim($query);
        $cacheKey = 'destination:nominatim:'.sha1($query);

        if (Cache::has($cacheKey)) {
            return Cache::get($cacheKey);
        }

        if (RateLimiter::tooManyAttempts('nominatim-public', 1)) {
            return null;
        }

        RateLimiter::hit('nominatim-public', 1);

        $response = Http::withHeaders([
            'User-Agent' => config('services.nominatim.user_agent'),
            'Accept-Language' => app()->getLocale(),
        ])->timeout(3)->retry(1, 100)->get('https://nominatim.openstreetmap.org/search', [
            'q' => $query,
            'format' => 'jsonv2',
            'limit' => 1,
            'addressdetails' => 1,
        ])->throw();

        $item = $response->json('0');
        $result = is_array($item) && isset($item['lat'], $item['lon']) ? [
            'key' => 'nominatim:'.($item['place_id'] ?? sha1($query)),
            'label' => (string) ($item['name'] ?? $item['display_name'] ?? $query),
            'sub' => $item['display_name'] ?? null,
            'type' => (string) ($item['type'] ?? 'destination'),
            'latitude' => (float) $item['lat'],
            'longitude' => (float) $item['lon'],
        ] : null;

        Cache::put($cacheKey, $result, now()->addDay());

        return $result;
    }
}
