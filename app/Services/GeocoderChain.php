<?php

namespace App\Services;

use App\Contracts\DestinationGeocoder;
use App\Contracts\ReverseGeocoder;
use Illuminate\Contracts\Container\Container;

/**
 * Asks external geocoding providers in the configured order (services.geocoding.providers).
 *
 * Explicit searches and reverse lookups take the first provider that answers, so a failing, silent or
 * rate-limited provider falls through to the next. Suggestions interleave the providers' results in
 * that order, so a Dutch match leads while a later provider can still offer a place abroad.
 */
final class GeocoderChain implements DestinationGeocoder, ReverseGeocoder
{
    /** @var array<string, class-string<DestinationGeocoder&ReverseGeocoder>> */
    public const array PROVIDERS = [
        'pdok' => PdokGeocoder::class,
        'geoapify' => GeoapifyDestinationGeocoder::class,
        'nominatim' => NominatimDestinationResolver::class,
    ];

    /**
     * @param  list<DestinationGeocoder&ReverseGeocoder>  $providers
     */
    public function __construct(private array $providers) {}

    public static function fromConfig(Container $container): self
    {
        $names = array_values(array_intersect((array) config('services.geocoding.providers', []), array_keys(self::PROVIDERS)));

        return new self(array_map(fn (string $name): DestinationGeocoder&ReverseGeocoder => $container->make(self::PROVIDERS[$name]), $names));
    }

    public function autocomplete(string $query, int $limit = 5): array
    {
        $lists = array_map(fn (DestinationGeocoder $provider): array => $provider->autocomplete($query, $limit), $this->providers);
        $merged = [];
        $seen = [];

        for ($rank = 0; count($merged) < $limit && $lists !== [] && $rank < $limit; $rank++) {
            foreach ($lists as $results) {
                $result = $results[$rank] ?? null;
                if ($result === null) {
                    continue;
                }

                $key = mb_strtolower($result['label']).'|'.round($result['latitude'], 4).'|'.round($result['longitude'], 4);
                if (! isset($seen[$key]) && count($merged) < $limit) {
                    $seen[$key] = true;
                    $merged[] = $result;
                }
            }
        }

        return $merged;
    }

    public function resolve(string $query): ?array
    {
        foreach ($this->providers as $provider) {
            if ($result = $provider->resolve($query)) {
                return $result;
            }
        }

        return null;
    }

    public function reverse(float $latitude, float $longitude): ?array
    {
        foreach ($this->providers as $provider) {
            if ($address = $provider->reverse($latitude, $longitude)) {
                return $address;
            }
        }

        return null;
    }
}
