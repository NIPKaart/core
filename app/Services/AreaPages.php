<?php

namespace App\Services;

use App\Models\Country;
use App\Models\DatasetSource;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingRule;
use App\Models\Province;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Locale;

/**
 * The data behind the public area pages (#1307): one country, region or municipality, built only from what the map
 * publicly shows. An area is indexable while it has public parking; without it, its page stays reachable as noindex.
 */
final class AreaPages
{
    /** Municipalities linked as examples or neighbours. */
    private const int SHORTLIST = 5;

    public function __construct(private ParkingDiscovery $discovery) {}

    /**
     * Countries that have public parking, largest first.
     *
     * @return Collection<int, Country>
     */
    public function countries(): Collection
    {
        $totals = $this->totals();
        $ids = collect($totals)->pluck('country_id')->unique();

        return Country::query()->whereIn('id', $ids)->get()
            ->sortByDesc(fn (Country $country): int => $this->sum($totals, 'country_id', $country->id)['spaces'])
            ->values();
    }

    /**
     * Every page that should be indexed: countries, regions and municipalities with public parking.
     *
     * @return list<string>
     */
    public function indexableUrls(): array
    {
        $totals = collect($this->totals());
        $municipalities = Municipality::query()->with('country:id,code')->whereIn('id', $totals->keys())->orderBy('id')->get();
        // Regions follow the same parking-record hierarchy as their own page's indexability.
        $regions = Province::query()->with('country:id,code')->whereIn('id', $totals->pluck('province_id')->filter()->unique())->orderBy('id')->get();

        return [
            ...$municipalities->pluck('country')->unique('id')->map(fn (Country $country): string => $this->countryUrl($country))->all(),
            ...$regions->map(fn (Province $province): string => route('areas.region', [strtolower($province->country->code), $province->slug]))->all(),
            ...$municipalities->map(fn (Municipality $municipality): string => $this->municipalityUrl($municipality))->all(),
        ];
    }

    /** @return array<string, mixed> */
    public function country(Country $country): array
    {
        $totals = $this->totals();
        $municipalities = $this->municipalitiesWithParking($totals, Municipality::query()->where('country_id', $country->id));
        $sum = $this->sum($totals, 'country_id', $country->id);
        $regions = Province::query()->where('country_id', $country->id)->get()
            ->map(function (Province $province) use ($totals, $municipalities, $country): ?array {
                $sum = $this->sum($totals, 'province_id', $province->id);

                return $sum['spaces'] + $sum['garages'] + $sum['park_and_ride'] === 0 ? null : [
                    'name' => $province->name,
                    'href' => route('areas.region', [strtolower($country->code), $province->slug]),
                    'municipalities' => $municipalities->where('province_id', $province->id)->count(),
                    ...$this->counts($sum),
                ];
            })
            ->filter()
            ->sortByDesc('spaces')
            ->values()
            ->all();

        return [
            ...$this->page('country', $this->countryName($country), $sum, $this->mapUrl('country_id', $country->id), $this->discovery->areaPreview('country_id', $country->id)),
            'breadcrumbs' => [['name' => $this->countryName($country), 'href' => null]],
            'regions' => $regions,
            'municipalities' => $municipalities->map(fn (Municipality $municipality): array => [
                'name' => $municipality->name,
                'href' => $this->municipalityUrl($municipality),
                'spaces' => $this->spaces($totals[$municipality->id]),
            ])->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->values()->all(),
            'sources' => [
                'open_data' => $municipalities->filter(fn (Municipality $municipality): bool => $totals[$municipality->id]['municipal'] > 0)->count(),
                'community' => $municipalities->filter(fn (Municipality $municipality): bool => $totals[$municipality->id]['community'] > 0)->count(),
                'live' => $municipalities->filter(fn (Municipality $municipality): bool => $this->live($totals[$municipality->id]) > 0)->count(),
            ],
            'without_open_data' => $municipalities->filter(fn (Municipality $municipality): bool => $totals[$municipality->id]['municipal'] === 0 && $this->spaces($totals[$municipality->id]) > 0)->count(),
            'national_rule' => $this->nationalRule($country),
            'countries' => $this->countries()->reject(fn (Country $other): bool => $other->is($country))->map(fn (Country $other): array => [
                'name' => $this->countryName($other),
                'href' => $this->countryUrl($other),
                'municipalities' => collect($totals)->where('country_id', $other->id)->count(),
            ])->values()->all(),
        ];
    }

    /** @return array<string, mixed> */
    public function region(Province $province): array
    {
        $country = $province->country;
        $totals = $this->totals();
        $sum = $this->sum($totals, 'province_id', $province->id);
        $municipalities = $this->municipalitiesWithParking($totals, Municipality::query()->where('province_id', $province->id));
        $ownRules = ParkingRule::query()->whereIn('municipality_id', $municipalities->modelKeys())->get()->keyBy('municipality_id');

        return [
            ...$this->page('region', $province->name, $sum, $this->mapUrl('province_id', $province->id), $this->discovery->areaPreview('province_id', $province->id)),
            'country' => ['name' => $this->countryName($country), 'href' => $this->countryUrl($country)],
            'breadcrumbs' => [['name' => $this->countryName($country), 'href' => $this->countryUrl($country)], ['name' => $province->name, 'href' => null]],
            'municipalities' => $municipalities->map(fn (Municipality $municipality): array => [
                'name' => $municipality->name,
                'href' => $this->municipalityUrl($municipality),
                ...$this->counts($totals[$municipality->id]),
                'municipal' => $totals[$municipality->id]['municipal'] > 0,
            ])->values()->all(),
            'live_municipalities' => $municipalities->filter(fn (Municipality $municipality): bool => $this->live($totals[$municipality->id]) > 0)
                ->sortByDesc(fn (Municipality $municipality): int => $this->live($totals[$municipality->id]))
                ->pluck('name')->values()->all(),
            'municipal_rules' => $municipalities->filter(fn (Municipality $municipality): bool => $ownRules->has($municipality->id))
                ->sortByDesc(fn (Municipality $municipality): int => $this->spaces($totals[$municipality->id]))
                ->map(fn (Municipality $municipality): array => ['name' => $municipality->name, 'url' => $ownRules[$municipality->id]->url])
                ->values()->all(),
            'national_rule' => $this->nationalRule($country),
            'other_regions' => Province::query()->where('country_id', $country->id)->whereKeyNot($province->id)->get()
                ->map(fn (Province $other): array => ['name' => $other->name, 'href' => route('areas.region', [strtolower($country->code), $other->slug]), 'spaces' => $this->sum($totals, 'province_id', $other->id)['spaces']])
                ->filter(fn (array $other): bool => $other['spaces'] > 0)
                ->sortByDesc('spaces')->take(4)->values()->all(),
        ];
    }

    /** @return array<string, mixed> */
    public function municipality(Municipality $municipality): array
    {
        $country = $municipality->country;
        $province = $municipality->province;
        $totals = $this->totals();
        $own = $totals[$municipality->id] ?? null;
        $sum = $own === null ? $this->sum([], 'municipality_id', $municipality->id) : $this->counts($own) + ['last_confirmed_at' => $own['last_confirmed_at'], 'observed_at' => $own['observed_at']];
        $preview = $own === null ? null : $this->discovery->areaPreview('municipality_id', $municipality->id);
        $parent = $province === null ? null : ['name' => $province->name, 'href' => route('areas.region', [strtolower($country->code), $province->slug])];
        $neighbours = $this->municipalitiesWithParking($totals, Municipality::query()->where($province ? 'province_id' : 'country_id', $province?->id ?? $country->id)->whereKeyNot($municipality->id))
            ->sortByDesc(fn (Municipality $other): int => $this->spaces($totals[$other->id]))
            ->take(self::SHORTLIST);
        $ownRule = ParkingRule::query()->where('municipality_id', $municipality->id)->first();

        return [
            ...$this->page('municipality', $municipality->name, $sum, $preview === null ? $this->parentMapUrl($municipality) : $this->mapUrl('municipality_id', $municipality->id), $preview),
            'country' => ['name' => $this->countryName($country), 'href' => $this->countryUrl($country)],
            'region' => $parent,
            'breadcrumbs' => [['name' => $this->countryName($country), 'href' => $this->countryUrl($country)], ...($parent ? [$parent] : []), ['name' => $municipality->name, 'href' => null]],
            'rules' => array_values(array_filter([
                $ownRule ? ['scope' => 'municipality', 'name' => $municipality->name, ...$this->ruleLink($ownRule)] : null,
                ($national = $this->nationalRule($country)) ? ['scope' => 'country', 'name' => $this->countryName($country), ...$national] : null,
            ])),
            'community_confirmed_spaces' => $own['community_confirmed_spaces'] ?? 0,
            'gpkwijs_url' => $this->gpkwijsUrl($municipality),
            'sources' => [
                'municipal' => ($own['municipal'] ?? 0) > 0 ? $this->municipalSources($municipality) : [],
                'community' => ($own['community'] ?? 0) > 0,
                'observed_at' => $own['observed_at'] ?? null,
                'facilities' => ($own['garages'] ?? 0) + ($own['park_and_ride'] ?? 0) > 0,
            ],
            'neighbours' => $neighbours->map(fn (Municipality $other): array => ['name' => $other->name, 'href' => $this->municipalityUrl($other)])->values()->all(),
        ];
    }

    /** The country's name in the visitor's language, from its ISO code; the stored name is the fallback. */
    public function countryName(Country $country): string
    {
        $locale = app()->getLocale();
        $name = Locale::getDisplayRegion('-'.$country->code, $locale);

        // ICU names a code it does not know "Unknown Region" rather than returning nothing.
        return $name !== '' && $name !== Locale::getDisplayRegion('-ZZ', $locale) ? $name : $country->name;
    }

    public function countryUrl(Country $country): string
    {
        return route('areas.country', strtolower($country->code));
    }

    public function municipalityUrl(Municipality $municipality): string
    {
        return route('areas.municipality', [strtolower($municipality->country->code), $municipality->slug]);
    }

    /**
     * The fields every area page shares.
     *
     * @param  array<string, mixed>  $sum
     * @param  array<string, mixed>|null  $preview
     * @return array<string, mixed>
     */
    private function page(string $level, string $name, array $sum, ?string $mapUrl, ?array $preview): array
    {
        return [
            'level' => $level,
            'name' => $name,
            'indexable' => $sum['spaces'] + $sum['garages'] + $sum['park_and_ride'] > 0,
            'totals' => $sum,
            'map_url' => $mapUrl,
            'preview' => $preview,
        ];
    }

    /**
     * Municipalities within the query that have public parking, largest first.
     *
     * @param  array<int, array<string, mixed>>  $totals
     * @param  Builder<Municipality>  $query
     * @return \Illuminate\Database\Eloquent\Collection<int, Municipality>
     */
    private function municipalitiesWithParking(array $totals, Builder $query): Collection
    {
        return $query->with('country:id,code')->whereIn('id', array_keys($totals))->get()
            ->sortByDesc(fn (Municipality $municipality): int => $this->spaces($totals[$municipality->id]))
            ->values();
    }

    /**
     * The totals of every municipality matching a column, added up.
     *
     * @param  array<int, array<string, mixed>>  $totals
     * @return array{spaces: int, garages: int, park_and_ride: int, verified: int, live_garages: int, live_park_and_ride: int, municipalities: int, last_confirmed_at: ?string, observed_at: ?string}
     */
    private function sum(array $totals, string $column, int $id): array
    {
        $matching = $column === 'municipality_id' ? array_intersect_key($totals, [$id => true]) : array_filter($totals, fn (array $row): bool => $row[$column] === $id);
        $sum = ['spaces' => 0, 'garages' => 0, 'park_and_ride' => 0, 'verified' => 0, 'live_garages' => 0, 'live_park_and_ride' => 0, 'municipalities' => count($matching), 'last_confirmed_at' => null, 'observed_at' => null];
        foreach ($matching as $row) {
            foreach ($this->counts($row) as $key => $value) {
                $sum[$key] += $value;
            }
            $sum['last_confirmed_at'] = max($sum['last_confirmed_at'], $row['last_confirmed_at']);
            $sum['observed_at'] = max($sum['observed_at'], $row['observed_at']);
        }

        return $sum;
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array{spaces: int, garages: int, park_and_ride: int, verified: int, live_garages: int, live_park_and_ride: int}
     */
    private function counts(array $row): array
    {
        return [
            'spaces' => $row['spaces'] ?? $this->spaces($row),
            'garages' => $row['garages'],
            'park_and_ride' => $row['park_and_ride'],
            'verified' => $row['verified'],
            'live_garages' => $row['live_garages'],
            'live_park_and_ride' => $row['live_park_and_ride'],
        ];
    }

    /** @param  array<string, mixed>  $row */
    private function spaces(array $row): int
    {
        return $row['community'] + $row['municipal'];
    }

    /** @param  array<string, mixed>  $row */
    private function live(array $row): int
    {
        return $row['live_garages'] + $row['live_park_and_ride'];
    }

    /** @return array<int, array<string, mixed>> */
    private function totals(): array
    {
        return $this->discovery->municipalityTotals();
    }

    private function gpkwijsUrl(Municipality $municipality): ?string
    {
        if ($municipality->country->code !== 'NL') {
            return null;
        }

        // GPKwijs drops accent letters instead of transliterating them.
        $name = preg_replace('/[^a-zA-Z0-9\s-]/u', '', $municipality->name);
        $slug = Str::slug($name, language: null);

        [$provinceSuffix, $qualifiedSlugs] = match ($municipality->province?->geocode) {
            'NL-LI' => ['-l', ['beek', 'bergen', 'stein']],
            'NL-NH' => ['-nh', ['bergen', 'laren']],
            'NL-OV' => ['-o', ['hengelo']],
            'NL-ZE' => ['-z', ['middelburg']],
            'NL-ZH' => ['-zh', ['rijswijk']],
            default => ['', []],
        };

        if (in_array($slug, $qualifiedSlugs, true)) {
            $slug .= $provinceSuffix;
        }

        return $slug === '' ? null : "https://www.gpkwijs.nl/gemeente/{$slug}";
    }

    /** @return array{url: string, host: ?string}|null */
    private function nationalRule(Country $country): ?array
    {
        $rule = ParkingRule::query()->where('country_id', $country->id)->whereNull('municipality_id')->first();

        return $rule ? $this->ruleLink($rule) : null;
    }

    /** @return array{url: string, host: ?string} */
    private function ruleLink(ParkingRule $rule): array
    {
        $visible = $rule->forVisitors();

        return ['url' => $visible['url'], 'host' => $visible['host']];
    }

    /**
     * The datasets the municipality's public municipal places come from, with their latest published delivery.
     *
     * @return list<array{publisher: string, updated_at: ?string}>
     */
    private function municipalSources(Municipality $municipality): array
    {
        $sourceIds = ParkingMunicipal::query()->where('municipality_id', $municipality->id)->where('visibility', true)->distinct()->pluck('dataset_source_id')->filter();

        return DatasetSource::query()->whereKey($sourceIds)->get()
            ->map(fn (DatasetSource $source): array => [
                'publisher' => $source->publisher ?: $source->name,
                'updated_at' => $source->last_published_retrieved_at?->toISOString(),
            ])
            ->values()->all();
    }

    /** The map focused on the extent of an area's public parking, without starting a nearby search. */
    private function mapUrl(string $column, int $id): ?string
    {
        $preview = $this->discovery->areaPreview($column, $id);
        if ($preview === null) {
            return null;
        }

        return route('location-map', [
            'view' => 'area',
            ...array_map(fn (float $value): float => round($value, 6), $preview['bounds']),
        ]);
    }

    /** Without public parking of its own, a municipality hands off to the map around its region or country. */
    private function parentMapUrl(Municipality $municipality): string
    {
        return ($municipality->province ? $this->mapUrl('province_id', $municipality->province->id) : null)
            ?? $this->mapUrl('country_id', $municipality->country->id)
            ?? route('location-map');
    }
}
