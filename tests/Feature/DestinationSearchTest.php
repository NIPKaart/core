<?php

use App\Enums\ParkingStatus;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
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

    $response = $this->getJson('/destinations/suggestions?q=Museum')
        ->assertOk()
        ->assertJsonCount(2, 'results')
        ->assertJsonStructure(['results' => [['key', 'label', 'sub', 'type', 'latitude', 'longitude']]]);

    expect(collect($response->json('results'))->pluck('type')->sort()->values()->all())
        ->toBe(['offstreet', 'street']);
    expect(collect($response->json('results'))->firstWhere('type', 'street'))
        ->toMatchArray(['latitude' => 52.36, 'longitude' => 4.88]);
});

test('destination suggestions exclude unpublished internal records', function () {
    ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING, 'street' => 'Hidden destination']);

    $this->getJson('/destinations/suggestions?q=Hidden')->assertExactJson(['results' => []]);
});

test('destination suggestions validate deliberate bounded queries', function () {
    $this->getJson('/destinations/suggestions?q=a')->assertUnprocessable()->assertJsonValidationErrors('q');
    $this->getJson('/destinations/suggestions?q=Amsterdam&limit=11')->assertUnprocessable()->assertJsonValidationErrors('limit');
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

    $this->getJson('/destinations/suggestions?q=Rijksmuseum')
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

    $this->getJson('/destinations/resolve?q=Rijksmuseum')
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

    $this->getJson('/destinations/resolve?q=Fallback%20place')
        ->assertOk()
        ->assertJsonPath('result.key', 'geoapify:fallback');

    Http::assertSent(fn ($request) => str_contains($request->url(), 'api.geoapify.com'));
});

test('invalid or excessive queries return validation errors', function (array $query, string $field) {
    $this->getJson('/destinations/suggestions?'.http_build_query($query))->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    [['q' => ['Canal']], 'q'],
    [['q' => str_repeat('x', 201)], 'q'],
    [['q' => 'Canal', 'limit' => 'invalid'], 'limit'],
]);

test('place suggestions remain visible when local parking fills the suggestion limit', function () {
    config(['services.geoapify.key' => 'test-key']);
    ParkingSpace::factory()->count(5)->create(['status' => ParkingStatus::APPROVED, 'city' => 'Amsterdam']);
    Http::fake(['api.geoapify.com/*' => Http::response(['results' => [[
        'place_id' => 'amsterdam', 'name' => 'Amsterdam', 'result_type' => 'city', 'lat' => 52.37, 'lon' => 4.9,
    ]]])]);

    $this->getJson('/destinations/suggestions?q=Amsterdam')->assertJsonPath('results.0.key', 'geoapify:amsterdam')->assertJsonCount(5, 'results');
});

test('submitting a city resolves the destination rather than an arbitrary parking record', function () {
    Cache::flush();
    RateLimiter::clear('nominatim-public');
    config(['services.nominatim.enabled' => true]);
    ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'city' => 'Amsterdam']);
    Http::fake(['nominatim.openstreetmap.org/*' => Http::response([[
        'place_id' => 123, 'name' => 'Amsterdam', 'type' => 'city', 'lat' => '52.37', 'lon' => '4.9',
    ]])]);

    $this->getJson('/destinations/resolve?q=Amsterdam')->assertJsonPath('result.key', 'nominatim:123');
});

test('street suggestions group before limiting and include every published matching location in their bounds', function () {
    $place = Municipality::factory()->create(['name' => 'Amsterdam']);
    ParkingMunicipal::factory()->for($place)->count(12)->create([
        'street' => 'Sloterdijkerweg', 'visibility' => true, 'latitude' => 52.38, 'longitude' => 4.85,
    ]);
    ParkingMunicipal::factory()->for($place)->create([
        'street' => 'Sloterdijkerweg', 'visibility' => true, 'latitude' => 52.39, 'longitude' => 4.86,
    ]);
    ParkingMunicipal::factory()->for($place)->create([
        'street' => 'Sloterdijkerweg', 'visibility' => false, 'latitude' => 50, 'longitude' => 3,
    ]);

    $this->getJson('/destinations/suggestions?q=Sloterdijkerweg&limit=1')
        ->assertJsonCount(1, 'results')
        ->assertJsonPath('results.0.type', 'street')
        ->assertJsonPath('results.0.parking_count', 13)
        ->assertJsonPath('results.0.bounds', ['south' => 52.38, 'north' => 52.39, 'west' => 4.85, 'east' => 4.86]);
});

test('street groups keep different cities and individual facilities separate', function () {
    foreach (['Amsterdam', 'Haarlem'] as $city) {
        $place = Municipality::factory()->create(['name' => $city]);
        ParkingMunicipal::factory()->for($place)->count(2)->create(['street' => 'Stationsweg', 'visibility' => true]);
        ParkingOffstreet::factory()->for($place)->create(['name' => 'Stationsweg', 'visibility' => true]);
    }

    $response = $this->getJson('/destinations/suggestions?q=Stationsweg&limit=10')->assertJsonCount(4, 'results');
    expect(collect($response->json('results'))->where('type', 'street')->pluck('parking_count')->all())->toBe([2, 2]);
});
