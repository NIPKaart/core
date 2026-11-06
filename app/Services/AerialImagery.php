<?php

namespace App\Services;

/**
 * The aerial photo layers a reviewer can check a location against, in the configured order (services.imagery.providers).
 *
 * A national orthophoto is placed accurately to the decimetre but covers one country and returns blank tiles elsewhere,
 * so each layer names the countries it covers; a layer without countries covers the whole world. The first layer that
 * covers a location's country is the default and the others stay available to compare. See ADR 0014.
 */
final class AerialImagery
{
    /**
     * @var array<string, array{label: string, url: string, attribution: string, subdomains: list<string>, max_native_zoom: int, countries: list<string>|null}>
     */
    public const array PROVIDERS = [
        'pdok' => [
            'label' => 'PDOK',
            'url' => 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg',
            'attribution' => '&copy; <a href="https://www.pdok.nl/">PDOK</a> · Beeldmateriaal Nederland',
            'subdomains' => [],
            'max_native_zoom' => 21,
            'countries' => ['NL'],
        ],
        'google' => [
            'label' => 'Google',
            'url' => 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            'attribution' => '&copy; <a href="https://www.google.com/maps">Google</a>',
            'subdomains' => ['mt0', 'mt1', 'mt2', 'mt3'],
            'max_native_zoom' => 20,
            'countries' => null,
        ],
    ];

    /**
     * The layers covering a country, best first. Without a known country only worldwide layers apply.
     *
     * @return list<array{key: string, label: string, url: string, attribution: string, subdomains: list<string>, max_native_zoom: int}>
     */
    public function forCountry(?string $countryCode): array
    {
        $code = $countryCode === null ? null : strtoupper($countryCode);
        $layers = [];

        foreach ((array) config('services.imagery.providers', []) as $key) {
            $provider = self::PROVIDERS[$key] ?? null;
            if ($provider === null || ($provider['countries'] !== null && ! in_array($code, $provider['countries'], true))) {
                continue;
            }

            $layers[] = ['key' => $key, ...array_diff_key($provider, ['countries' => true])];
        }

        return $layers;
    }
}
