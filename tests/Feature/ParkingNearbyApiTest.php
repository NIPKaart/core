<?php

use App\Enums\ParkingStatus;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;

test('guests can discover public parking near a destination', function () {
    $near = ParkingSpace::factory()->create([
        'status' => ParkingStatus::APPROVED,
        'latitude' => 52.36,
        'longitude' => 4.88,
    ]);
    ParkingOffstreet::factory()->create([
        'visibility' => true,
        'latitude' => 53.0,
        'longitude' => 5.0,
    ]);

    $this->getJson('/map/parking/nearby?latitude=52.36&longitude=4.88&radius=500')
        ->assertOk()
        ->assertJsonCount(1, 'results')
        ->assertJsonPath('results.0.key', 'community:'.$near->id)
        ->assertJsonPath('results.0.distance_metres', 0);
});

test('nearby parking discovery validates coordinates radius and limit', function () {
    $this->getJson('/map/parking/nearby?latitude=91&longitude=4.88')->assertUnprocessable()->assertJsonValidationErrors('latitude');
    $this->getJson('/map/parking/nearby?latitude=52&longitude=181')->assertUnprocessable()->assertJsonValidationErrors('longitude');
    $this->getJson('/map/parking/nearby?latitude=52&longitude=5&radius=20')->assertUnprocessable()->assertJsonValidationErrors('radius');
    $this->getJson('/map/parking/nearby?latitude=52&longitude=5&limit=201')->assertUnprocessable()->assertJsonValidationErrors('limit');
});

test('balanced ordering gives street spaces a bounded preference and paginates after ordering', function () {
    ParkingMunicipal::factory()->create(['id' => 'near-street', 'latitude' => 52.001, 'longitude' => 5, 'visibility' => true]);
    ParkingMunicipal::factory()->create(['id' => 'far-street', 'latitude' => 52.005, 'longitude' => 5, 'visibility' => true]);
    ParkingOffstreet::factory()->create(['id' => 'b', 'latitude' => 52, 'longitude' => 5, 'visibility' => true]);
    ParkingOffstreet::factory()->create(['id' => 'a', 'latitude' => 52, 'longitude' => 5, 'visibility' => true]);
    $query = ['latitude' => 52, 'longitude' => 5, 'radius' => 1000, 'sort' => 'balanced', 'limit' => 2];

    $this->getJson(route('map.parking.nearby', $query))->assertOk()
        ->assertJsonPath('results.0.key', 'municipal:near-street')
        ->assertJsonPath('results.1.key', 'offstreet:a')
        ->assertJsonPath('results.1.distance_metres', 0)
        ->assertJsonPath('has_more', true);
    $this->getJson(route('map.parking.nearby', [...$query, 'page' => 2]))->assertOk()
        ->assertJsonPath('results.0.key', 'offstreet:b')
        ->assertJsonPath('results.1.key', 'municipal:far-street')
        ->assertJsonPath('has_more', false);
    $this->getJson(route('map.parking.nearby', [...$query, 'sort' => 'distance']))->assertOk()
        ->assertJsonPath('results.0.key', 'offstreet:a')->assertJsonPath('results.1.key', 'offstreet:b');
});

test('source and radius filtering exclude other sources and hidden records before pagination', function (string $source) {
    $models = ['community' => ParkingSpace::class, 'municipal' => ParkingMunicipal::class, 'offstreet' => ParkingOffstreet::class];
    $keys = [];
    foreach ($models as $name => $model) {
        $public = $name === 'community' ? ['status' => ParkingStatus::APPROVED] : ['visibility' => true];
        $hidden = $name === 'community' ? ['status' => ParkingStatus::PENDING] : ['visibility' => false];
        $record = $model::factory()->create(['latitude' => 52, 'longitude' => 5, ...$public]);
        $keys[$name] = $name.':'.$record->id;
        $model::factory()->create(['latitude' => 52, 'longitude' => 5, ...$hidden]);
        $model::factory()->create(['latitude' => 53, 'longitude' => 5, ...$public]);
    }

    $this->getJson(route('map.parking.nearby', ['latitude' => 52, 'longitude' => 5, 'source' => $source, 'radius' => 250, 'limit' => 1]))
        ->assertOk()->assertJsonCount(1, 'results')->assertJsonPath('results.0.key', $keys[$source])->assertJsonPath('has_more', false);
})->with(['community', 'municipal', 'offstreet']);

test('nearby filters reject unsupported sources sorts and pagination', function (string $field, mixed $value) {
    $this->getJson(route('map.parking.nearby', ['latitude' => 52, 'longitude' => 5, $field => $value]))
        ->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    ['source', 'unknown'], ['source', ''], ['sort', 'availability'], ['sort', ''], ['page', 0], ['page', 1.5], ['page', 1000001],
]);
