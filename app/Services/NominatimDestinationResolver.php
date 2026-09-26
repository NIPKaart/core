<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
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

        $cached = Cache::get($cacheKey);
        if (is_array($cached) && array_key_exists('result', $cached)) {
            return $cached['result'];
        }

        if (RateLimiter::tooManyAttempts('nominatim-public', 1)) {
            return null;
        }

        RateLimiter::hit('nominatim-public', 1);

        try {
            $response = Http::withHeaders([
                'User-Agent' => config('services.nominatim.user_agent'),
                'Accept-Language' => app()->getLocale(),
            ])->timeout(3)->get('https://nominatim.openstreetmap.org/search', [
                'q' => $query,
                'format' => 'jsonv2',
                'limit' => 1,
                'addressdetails' => 1,
            ])->throw();
        } catch (ConnectionException|RequestException $exception) {
            Log::warning('Destination provider request failed.', ['provider' => 'nominatim', 'exception' => $exception::class]);

            return null;
        }

        $item = $response->json('0');
        $result = is_array($item) && isset($item['lat'], $item['lon']) ? [
            'key' => 'nominatim:'.($item['place_id'] ?? sha1($query)),
            'label' => (string) ($item['name'] ?? $item['display_name'] ?? $query),
            'sub' => $item['display_name'] ?? null,
            'type' => (string) ($item['type'] ?? 'destination'),
            'latitude' => (float) $item['lat'],
            'longitude' => (float) $item['lon'],
        ] : null;

        Cache::put($cacheKey, ['result' => $result], now()->addDay());

        return $result;
    }
}
