<?php

namespace App\Services;

use App\Contracts\DestinationGeocoder;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class GeoapifyDestinationGeocoder implements DestinationGeocoder
{
    public function autocomplete(string $query, int $limit = 5): array
    {
        return $this->request('autocomplete', $query, $limit);
    }

    public function resolve(string $query): ?array
    {
        return $this->request('search', $query, 1)[0] ?? null;
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
