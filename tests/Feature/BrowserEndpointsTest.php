<?php

use App\Enums\ParkingStatus;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;

test('browser endpoints no longer exist under the API namespace', function (string $path) {
    $this->getJson('/api/'.$path)->assertNotFound();
})->with([
    'destinations/suggestions?q=Museum',
    'destinations/resolve?q=Museum',
    'parking/viewport?west=4&south=52&east=5&north=53',
    'parking/nearby?latitude=52&longitude=5',
    'search?q=Museum',
]);

test('map details remain public and use the signed in session for favorites', function (string $model, array $attributes, string $route, string $legacyPath) {
    $space = $model::factory()->create($attributes);
    $user = User::factory()->create();
    $user->favorites()->create([
        'favoritable_type' => $space->getMorphClass(),
        'favoritable_id' => $space->id,
    ]);

    $this->getJson(route($route, $space->id))
        ->assertOk()->assertJsonPath('id', $space->id)->assertJsonPath('is_favorited', false)
        ->assertJsonPath('latitude', $space->latitude)->assertJsonPath('longitude', $space->longitude);

    $this->getJson($legacyPath.$space->id)->assertNotFound();

    $this->withSession([auth()->guard('web')->getName() => $user->id])
        ->getJson(route($route, $space->id))
        ->assertOk()->assertJsonPath('is_favorited', true);
})->with([
    'community' => [ParkingSpace::class, ['status' => ParkingStatus::APPROVED], 'map.parking-spaces.show', '/api/parking-spaces/'],
    'municipal' => [ParkingMunicipal::class, ['visibility' => true], 'map.parking-municipal.show', '/api/parking-municipal/'],
    'offstreet' => [ParkingOffstreet::class, ['visibility' => true], 'map.parking-offstreet.show', '/api/parking-offstreet/'],
]);

test('normal interactive parking reads exceed the former limits without throttling', function (string $path, int $status) {
    Cache::flush();
    $this->freezeTime();

    for ($request = 0; $request < 61; $request++) {
        $this->getJson($path)->assertStatus($status);
    }
})->with([
    'community details' => ['/map/parking-spaces/00000000-0000-4000-8000-000000000000', 404],
    'municipal details' => ['/map/parking-municipal/00000000-0000-4000-8000-000000000000', 404],
    'offstreet details' => ['/map/parking-offstreet/00000000-0000-4000-8000-000000000000', 404],
]);

test('destination lookups share a separate budget without blocking local parking reads', function () {
    Cache::flush();
    $this->freezeTime();
    $space = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);

    for ($request = 0; $request < 60; $request++) {
        $this->getJson(route('destinations.suggestions', ['q' => 'zz']))->assertOk();
    }

    $this->getJson(route('destinations.suggestions', ['q' => 'zz']))->assertStatus(429)
        ->assertHeader('Content-Type', 'application/json')->assertHeader('Retry-After');
    $this->getJson(route('destinations.resolve', ['q' => 'zz']))->assertStatus(429);

    $this->getJson(route('map.parking-spaces.show', $space->id))->assertOk();
    $this->getJson(route('map.parking.nearby', ['latitude' => 52, 'longitude' => 5]))
        ->assertOk()->assertHeader('X-RateLimit-Remaining', '999');
    expect(RateLimiter::attempts(md5('parking-discoveryhour:ip:127.0.0.1')))->toBe(1);
    $this->getJson(route('map.parking.viewport', ['west' => 4, 'south' => 52, 'east' => 5, 'north' => 53]))->assertOk();

    $this->travel(61)->seconds();
    $this->getJson(route('destinations.suggestions', ['q' => 'zz']))->assertOk();
});

test('exhausting destination lookups does not consume other account request budgets', function () {
    Cache::flush();
    $this->freezeTime();
    $this->actingAs(User::factory()->create());

    for ($request = 0; $request < 60; $request++) {
        $this->getJson(route('destinations.suggestions', ['q' => 'zz']))->assertOk();
    }

    $this->getJson(route('destinations.resolve', ['q' => 'zz']))->assertStatus(429);
    $this->getJson(route('app.municipal-imports.index'))->assertForbidden();

    $this->actingAs(User::factory()->create());
    $this->getJson(route('destinations.suggestions', ['q' => 'zz']))->assertOk();
});

test('missing map details return JSON to browser fetch consumers', function (string $route) {
    $this->getJson(route($route, '00000000-0000-4000-8000-000000000000'))
        ->assertNotFound()->assertHeader('Content-Type', 'application/json')->assertJsonStructure(['message']);
})->with(['map.parking-spaces.show', 'map.parking-municipal.show', 'map.parking-offstreet.show']);

test('obsolete parking search pages and endpoints are no longer exposed', function (string $path) {
    $this->actingAs(User::factory()->create())->getJson($path)->assertNotFound();
})->with(['/search?q=Museum', '/search/results?q=Museum']);

/**
 * Seed Laravel's named-middleware counters without issuing spatial queries.
 * ThrottleRequests hashes the limiter name concatenated with each window key.
 */
function seedParkingDiscoveryAttempts(string $identity, int $minute, int $hour): void
{
    RateLimiter::increment(md5('parking-discoveryminute:'.$identity), 60, $minute);
    RateLimiter::increment(md5('parking-discoveryhour:'.$identity), 3600, $hour);
}

test('interactive discovery exceeds 300 requests before enforcing the minute ceiling', function (string $path) {
    Cache::flush();
    $this->freezeTime();
    seedParkingDiscoveryAttempts('ip:127.0.0.1', 300, 300);

    $this->getJson($path)->assertOk()->assertHeader('X-RateLimit-Remaining', '699');

    seedParkingDiscoveryAttempts('ip:127.0.0.1', 698, 698);
    $this->getJson($path)->assertOk()->assertHeader('X-RateLimit-Remaining', '0');
    $this->getJson($path)->assertStatus(429)->assertHeader('Retry-After', '60');
    $this->getJson(route('destinations.suggestions', ['q' => 'zz']))
        ->assertOk()->assertHeader('X-RateLimit-Remaining', '59');

    $this->travel(61)->seconds();
    $this->getJson($path)->assertOk()->assertHeader('X-RateLimit-Remaining', '999');
})->with([
    'viewport' => ['/map/parking/viewport?west=4&south=52&east=5&north=53'],
    'nearby' => ['/map/parking/nearby?latitude=52&longitude=5'],
]);

test('the hourly discovery ceiling survives the minute reset and is shared by both endpoints', function () {
    Cache::flush();
    $this->freezeTime();
    seedParkingDiscoveryAttempts('ip:127.0.0.1', 999, 9999);
    $viewport = route('map.parking.viewport', ['west' => 4, 'south' => 52, 'east' => 5, 'north' => 53]);
    $nearby = route('map.parking.nearby', ['latitude' => 52, 'longitude' => 5]);

    $this->getJson($viewport)->assertOk();
    $this->travel(61)->seconds();

    $this->getJson($nearby)->assertStatus(429)->assertHeader('Retry-After', '3539');
    $this->getJson($viewport)->assertStatus(429)->assertHeader('Content-Type', 'application/json');
    $this->getJson(route('destinations.suggestions', ['q' => 'zz']))
        ->assertOk()->assertHeader('X-RateLimit-Remaining', '59');

    $this->travel(3540)->seconds();
    $this->getJson($nearby)->assertOk();
});

test('guest discovery limits are isolated by IP', function (int $minute, int $hour) {
    Cache::flush();
    $this->freezeTime();
    seedParkingDiscoveryAttempts('ip:127.0.0.1', $minute, $hour);
    $nearby = route('map.parking.nearby', ['latitude' => 52, 'longitude' => 5]);

    $this->getJson($nearby)->assertStatus(429);
    $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.2'])->getJson($nearby)->assertOk();
})->with(['minute' => [1000, 0], 'hour' => [0, 10000]]);

test('authenticated discovery limits follow the account rather than its IP', function (int $minute, int $hour) {
    Cache::flush();
    $this->freezeTime();
    $user = User::factory()->create();
    $this->actingAs($user);
    seedParkingDiscoveryAttempts('user:'.$user->id, $minute, $hour);
    $nearby = route('map.parking.nearby', ['latitude' => 52, 'longitude' => 5]);

    $this->getJson($nearby)->assertStatus(429);
    $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.2'])->getJson($nearby)->assertStatus(429);
    $this->actingAs(User::factory()->create())->getJson($nearby)->assertOk();
})->with(['minute' => [1000, 0], 'hour' => [0, 10000]]);

test('viewport pages expose every matching public result without moving the map', function () {
    ParkingMunicipal::factory()->count(3)->sequence(['id' => 'a'], ['id' => 'b'], ['id' => 'c'])->create(['latitude' => 52, 'longitude' => 5, 'visibility' => true]);
    ParkingMunicipal::factory()->create(['latitude' => 52, 'longitude' => 5, 'visibility' => false]);
    ParkingOffstreet::factory()->create(['id' => 'a', 'latitude' => 52, 'longitude' => 5, 'visibility' => true]);
    $query = ['west' => 4, 'south' => 51, 'east' => 6, 'north' => 53, 'limit' => 2];
    $this->getJson(route('map.parking.viewport', $query))->assertOk()->assertJsonCount(2, 'results')->assertJsonPath('results.0.key', 'municipal:a')->assertJsonPath('results.1.key', 'municipal:b')->assertJsonPath('has_more', true);
    $this->getJson(route('map.parking.viewport', [...$query, 'page' => 2]))->assertOk()->assertJsonCount(2, 'results')->assertJsonPath('results.0.key', 'municipal:c')->assertJsonPath('results.1.key', 'offstreet:a')->assertJsonPath('has_more', false);
    $this->getJson(route('map.parking.viewport', [...$query, 'page' => 3]))->assertOk()->assertJsonCount(0, 'results')->assertJsonPath('has_more', false);
});

test('viewport rejects invalid page numbers', function ($page) {
    $this->getJson(route('map.parking.viewport', ['west' => 4, 'south' => 51, 'east' => 6, 'north' => 53, 'page' => $page]))->assertUnprocessable()->assertJsonValidationErrors('page');
})->with([0, -1, 1.5, 1000001]);

test('viewport results report distance to the destination without reordering pages', function () {
    ParkingMunicipal::factory()->create(['id' => 'a', 'latitude' => 52.01, 'longitude' => 5, 'visibility' => true]);
    ParkingMunicipal::factory()->create(['id' => 'b', 'latitude' => 52, 'longitude' => 5, 'visibility' => true]);
    $query = ['west' => 4, 'south' => 51, 'east' => 6, 'north' => 53];

    $response = $this->getJson(route('map.parking.viewport', [...$query, 'origin_latitude' => 52, 'origin_longitude' => 5]))->assertOk()
        ->assertJsonPath('results.0.key', 'municipal:a')->assertJsonPath('results.1.key', 'municipal:b');
    expect($response->json('results.0.distance_metres'))->toEqualWithDelta(1113, 5)
        ->and($response->json('results.1.distance_metres'))->toEqual(0);

    $this->getJson(route('map.parking.viewport', $query))->assertOk()->assertJsonPath('results.0.distance_metres', null);
});

test('viewport distance needs a complete and valid destination', function (array $origin, string $error) {
    $this->getJson(route('map.parking.viewport', ['west' => 4, 'south' => 51, 'east' => 6, 'north' => 53, ...$origin]))
        ->assertUnprocessable()->assertJsonValidationErrors($error);
})->with([
    'latitude only' => [['origin_latitude' => 52], 'origin_longitude'],
    'longitude only' => [['origin_longitude' => 5], 'origin_latitude'],
    'out of range' => [['origin_latitude' => 91, 'origin_longitude' => 5], 'origin_latitude'],
]);
