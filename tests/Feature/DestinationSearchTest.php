<?php

use App\Enums\ParkingStatus;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;

test('destination suggestions normalize internal parking results', function () {
    ParkingSpace::factory()->create([
        'status' => ParkingStatus::APPROVED,
        'street' => 'Museumstraat',
        'city' => 'Amsterdam',
        'latitude' => 52.36,
        'longitude' => 4.88,
    ]);
    ParkingOffstreet::factory()->create([
        'name' => 'Museumplein garage',
        'visibility' => true,
        'latitude' => 52.35,
        'longitude' => 4.87,
    ]);

    $response = $this->getJson('/api/destinations/suggestions?q=Museum')
        ->assertOk()
        ->assertJsonCount(2, 'results')
        ->assertJsonStructure(['results' => [['key', 'label', 'sub', 'type', 'latitude', 'longitude']]]);

    expect(collect($response->json('results'))->pluck('type')->sort()->values()->all())
        ->toBe(['community', 'offstreet']);
    expect(collect($response->json('results'))->firstWhere('type', 'community'))
        ->toMatchArray(['latitude' => 52.36, 'longitude' => 4.88]);
});

test('destination suggestions exclude unpublished internal records', function () {
    ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING, 'street' => 'Hidden destination']);

    $this->getJson('/api/destinations/suggestions?q=Hidden')->assertExactJson(['results' => []]);
});

test('destination suggestions validate deliberate bounded queries', function () {
    $this->getJson('/api/destinations/suggestions?q=a')->assertUnprocessable()->assertJsonValidationErrors('q');
    $this->getJson('/api/destinations/suggestions?q=Amsterdam&limit=11')->assertUnprocessable()->assertJsonValidationErrors('limit');
});


test('autocomplete supplements internal results with geoapify when configured', function () {
    config(['services.geoapify.key' => 'test-key']);
    Http::fake([
        'api.geoapify.com/*' => Http::response(['results' => [[
            'place_id' => 'museum',
            'name' => 'Rijksmuseum',
            'formatted' => 'Rijksmuseum, Amsterdam, Netherlands',
            'result_type' => 'amenity',
            'lat' => 52.359998,
            'lon' => 4.885219,
        ]]]),
    ]);

    $this->getJson('/api/destinations/suggestions?q=Rijksmuseum')
        ->assertOk()
        ->assertJsonPath('results.0.key', 'geoapify:museum')
        ->assertJsonPath('results.0.latitude', 52.359998);

    Http::assertSentCount(1);
});

test('explicit resolution prefers nominatim and avoids geoapify fallback when resolved', function () {
    Cache::flush();
    RateLimiter::clear('nominatim-public');
    config(['services.geoapify.key' => 'test-key', 'services.nominatim.enabled' => true]);
    Http::fake([
        'nominatim.openstreetmap.org/*' => Http::response([[
            'place_id' => 123,
            'name' => 'Rijksmuseum',
            'display_name' => 'Rijksmuseum, Museumstraat, Amsterdam',
            'type' => 'museum',
            'lat' => '52.359998',
            'lon' => '4.885219',
        ]]),
        'api.geoapify.com/*' => Http::response(['results' => []]),
    ]);

    $this->getJson('/api/destinations/resolve?q=Rijksmuseum')
        ->assertOk()
        ->assertJsonPath('result.key', 'nominatim:123')
        ->assertJsonPath('result.type', 'museum');

    Http::assertSentCount(1);
});

test('explicit resolution falls back to geoapify when public nominatim budget is unavailable', function () {
    Cache::flush();
    RateLimiter::clear('nominatim-public');
    RateLimiter::hit('nominatim-public', 60);
    config(['services.geoapify.key' => 'test-key', 'services.nominatim.enabled' => true]);
    Http::fake([
        'api.geoapify.com/*' => Http::response(['results' => [[
            'place_id' => 'fallback',
            'name' => 'Fallback place',
            'result_type' => 'amenity',
            'lat' => 50.0,
            'lon' => 5.0,
        ]]]),
    ]);

    $this->getJson('/api/destinations/resolve?q=Fallback%20place')
        ->assertOk()
        ->assertJsonPath('result.key', 'geoapify:fallback');

    Http::assertSent(fn ($request) => str_contains($request->url(), 'api.geoapify.com'));
});
