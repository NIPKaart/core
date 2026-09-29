<?php

namespace App\Services;

use App\Contracts\DestinationGeocoder;
use App\Contracts\ReverseGeocoder;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * The Dutch government's PDOK Locatieserver: official BAG addresses, streets, postcodes and places in the Netherlands.
 *
 * It only knows the Netherlands and answers every query with its closest Dutch match, so results are only accepted
 * when they really match the query (a search for "Paris" must not become "Arthur Parisiusstraat") or lie near the pin.
 */
final class PdokGeocoder implements DestinationGeocoder, ReverseGeocoder
{
    private const string BASE_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1';

    private const string FIELDS = 'id,type,weergavenaam,centroide_ll,straatnaam,woonplaatsnaam,gemeentenaam,provincienaam,provincieafkorting,postcode,wijknaam,buurtnaam,afstand';

    /** A reverse answer further away than this is a nearby Dutch address for a pin outside the Netherlands. */
    private const float MAX_REVERSE_METRES = 250;

    /** PDOK result types and the destination types the discovery map understands. */
    private const array TYPES = ['adres' => 'address', 'weg' => 'street', 'postcode' => 'postcode', 'woonplaats' => 'city', 'gemeente' => 'municipality'];

    public function autocomplete(string $query, int $limit = 5): array
    {
        return collect($this->suggest($query, $limit))
            ->filter(fn (array $doc): bool => $this->matches($doc, $query, wholeWord: false))
            ->map(fn (array $doc): ?array => $this->destination($doc))
            ->filter()->values()->all();
    }

    public function resolve(string $query): ?array
    {
        $doc = collect($this->suggest($query, 3))->first(fn (array $doc): bool => $this->matches($doc, $query, wholeWord: true));

        return $doc ? $this->destination($doc) : null;
    }

    public function reverse(float $latitude, float $longitude): ?array
    {
        if ($latitude < 50.6 || $latitude > 53.7 || $longitude < 3.2 || $longitude > 7.3) {
            return null;
        }

        $doc = $this->request('reverse', ['lat' => $latitude, 'lon' => $longitude, 'rows' => 1, 'fl' => self::FIELDS])[0] ?? null;
        if (! is_array($doc) || (float) ($doc['afstand'] ?? INF) > self::MAX_REVERSE_METRES || empty($doc['gemeentenaam'])) {
            return null;
        }

        return array_filter([
            'country_code' => 'nl',
            'state' => $doc['provincienaam'] ?? null,
            'ISO3166-2-lvl4' => isset($doc['provincieafkorting']) ? 'NL-'.$doc['provincieafkorting'] : null,
            'municipality' => $doc['gemeentenaam'],
            'city' => $doc['woonplaatsnaam'] ?? null,
            'road' => $doc['straatnaam'] ?? null,
            'postcode' => $doc['postcode'] ?? null,
            'suburb' => $doc['wijknaam'] ?? null,
            'neighbourhood' => $doc['buurtnaam'] ?? null,
        ], fn (mixed $value): bool => is_string($value) && $value !== '');
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function suggest(string $query, int $limit): array
    {
        $query = trim($query);
        $limit = max(1, min(10, $limit));

        $cacheKey = 'destination:pdok:'.sha1($query.'|'.$limit);
        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }

        $docs = $this->request('suggest', [
            'q' => $query,
            'rows' => $limit,
            'fl' => self::FIELDS,
            'fq' => 'type:('.implode(' OR ', array_keys(self::TYPES)).')',
        ]);
        if ($docs !== null) {
            Cache::put($cacheKey, $docs, now()->addDay());
        }

        return $docs ?? [];
    }

    /**
     * @param  array<string, mixed>  $parameters
     * @return list<array<string, mixed>>|null null when the request failed, so the failure is not cached
     */
    private function request(string $endpoint, array $parameters): ?array
    {
        try {
            return Http::timeout(3)->get(self::BASE_URL.'/'.$endpoint, $parameters)->throw()->json('response.docs', []);
        } catch (ConnectionException|RequestException $exception) {
            Log::warning('Destination provider request failed.', ['provider' => 'pdok', 'exception' => $exception::class]);

            return null;
        }
    }

    /**
     * Whether a result really matches the query: its name starts with the query's first word and contains every
     * other word, so "Herengracht 433 Amsterdam" matches "Herengracht 433, 1017BR Amsterdam" but "Paris" does not
     * match "Arthur Parisiusstraat". While typing, the last word may still be incomplete.
     *
     * @param  array<string, mixed>  $doc
     */
    private function matches(array $doc, string $query, bool $wholeWord): bool
    {
        $name = explode(' ', $this->normalize(Str::after((string) ($doc['weergavenaam'] ?? ''), 'Gemeente ')));
        $words = array_values(array_filter(explode(' ', $this->normalize($query))));
        if ($words === []) {
            return false;
        }

        $last = count($words) - 1;
        $matchesWord = fn (string $word, string $candidate, int $index): bool => $candidate === $word
            || (! $wholeWord && $index === $last && str_starts_with($candidate, $word));

        foreach ($words as $index => $word) {
            $found = $index === 0
                ? $matchesWord($word, $name[0], $index)
                : collect($name)->contains(fn (string $candidate): bool => $matchesWord($word, $candidate, $index));
            if (! $found) {
                return false;
            }
        }

        return true;
    }

    private function normalize(string $text): string
    {
        return trim((string) preg_replace('/\s+/', ' ', preg_replace('/[^\p{L}\p{N}]+/u', ' ', Str::lower(Str::ascii($text)))));
    }

    /**
     * @param  array<string, mixed>  $doc
     * @return array{key: string, label: string, sub: ?string, type: string, latitude: float, longitude: float}|null
     */
    private function destination(array $doc): ?array
    {
        if (! preg_match('/POINT\((-?[\d.]+) (-?[\d.]+)\)/', (string) ($doc['centroide_ll'] ?? ''), $point)) {
            return null;
        }

        $name = (string) $doc['weergavenaam'];

        return [
            'key' => 'pdok:'.$doc['id'],
            'label' => Str::before($name, ', '),
            'sub' => str_contains($name, ', ') ? Str::after($name, ', ') : ($doc['provincienaam'] ?? null),
            'type' => self::TYPES[$doc['type']] ?? 'destination',
            'latitude' => (float) $point[2],
            'longitude' => (float) $point[1],
        ];
    }
}
