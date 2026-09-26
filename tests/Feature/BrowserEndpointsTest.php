<?php

use App\Enums\ParkingStatus;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

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
        ->assertOk()->assertJsonPath('id', $space->id)->assertJsonPath('is_favorited', false);

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
    'nearby' => ['/map/parking/nearby?latitude=52&longitude=5', 200],
    'viewport' => ['/map/parking/viewport?west=4&south=52&east=5&north=53', 200],
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
    $this->getJson(route('map.parking.nearby', ['latitude' => 52, 'longitude' => 5]))->assertOk();
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

test('guest discovery has a shared 300 request budget independent of destinations and other IPs', function () {
    Cache::flush();
    $this->freezeTime();
    $viewport = route('map.parking.viewport', ['west' => 4, 'south' => 52, 'east' => 5, 'north' => 53]);
    $nearby = route('map.parking.nearby', ['latitude' => 52, 'longitude' => 5]);

    for ($request = 0; $request < 150; $request++) {
        $this->getJson($viewport)->assertOk();
        $this->getJson($nearby)->assertOk();
    }

    $this->getJson($viewport)->assertStatus(429)->assertHeader('Retry-After', '60');
    $this->getJson($nearby)->assertStatus(429)->assertHeader('Content-Type', 'application/json');
    $this->getJson(route('destinations.suggestions', ['q' => 'zz']))->assertOk();
    $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.2'])->getJson($viewport)->assertOk();
    $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1']);

    $this->travel(61)->seconds();
    $this->getJson($viewport)->assertOk();
});

test('signed in discovery budgets follow the account rather than its IP', function () {
    Cache::flush();
    $this->freezeTime();
    $this->actingAs(User::factory()->create());
    $nearby = route('map.parking.nearby', ['latitude' => 52, 'longitude' => 5]);

    for ($request = 0; $request < 300; $request++) {
        $this->getJson($nearby)->assertOk();
    }

    $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.2'])->getJson($nearby)->assertStatus(429);
    $this->actingAs(User::factory()->create())->getJson($nearby)->assertOk();
});
