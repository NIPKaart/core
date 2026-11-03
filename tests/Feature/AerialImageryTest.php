<?php

use App\Services\AerialImagery;

/**
 * @return list<string>
 */
function aerialKeys(?string $country): array
{
    return array_column(app(AerialImagery::class)->forCountry($country), 'key');
}

test('a national photo comes first where it covers the country and the worldwide photo stays to compare', function () {
    config(['services.imagery.providers' => ['pdok', 'google']]);

    expect(aerialKeys('NL'))->toBe(['pdok', 'google'])
        ->and(aerialKeys('nl'))->toBe(['pdok', 'google'])
        ->and(aerialKeys('BE'))->toBe(['google'])
        ->and(aerialKeys(null))->toBe(['google']);
});

test('the configured order decides which photo opens and unknown providers are ignored', function () {
    config(['services.imagery.providers' => ['google', 'unknown', 'pdok']]);

    expect(aerialKeys('NL'))->toBe(['google', 'pdok']);
});

test('a layer carries what the map needs to draw it without its coverage', function () {
    config(['services.imagery.providers' => ['pdok']]);

    expect(app(AerialImagery::class)->forCountry('NL'))->toBe([[
        'key' => 'pdok',
        'label' => 'PDOK',
        'url' => 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg',
        'attribution' => '&copy; <a href="https://www.pdok.nl/">PDOK</a> · Beeldmateriaal Nederland',
        'subdomains' => [],
        'max_native_zoom' => 21,
    ]]);
});
