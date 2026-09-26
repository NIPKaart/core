<?php

use App\Enums\ParkingStatus;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;

test('guests can discover public parking inside a viewport', function () {
    $inside = ParkingSpace::factory()->create([
        'status' => ParkingStatus::APPROVED,
        'latitude' => 52.36,
        'longitude' => 4.88,
    ]);
    ParkingOffstreet::factory()->create([
        'visibility' => true,
        'latitude' => 53.0,
        'longitude' => 5.0,
    ]);

    $this->getJson('/map/parking/viewport?west=4.8&south=52.3&east=4.9&north=52.4')
        ->assertOk()
        ->assertJsonCount(1, 'results')
        ->assertJsonPath('results.0.key', 'community:'.$inside->id);
});

test('viewport parking discovery validates bounds and limit', function () {
    $this->getJson('/map/parking/viewport?west=-181&south=52&east=5&north=53')->assertUnprocessable()->assertJsonValidationErrors('west');
    $this->getJson('/map/parking/viewport?west=4&south=-91&east=5&north=53')->assertUnprocessable()->assertJsonValidationErrors('south');
    $this->getJson('/map/parking/viewport?west=4&south=52&east=181&north=53')->assertUnprocessable()->assertJsonValidationErrors('east');
    $this->getJson('/map/parking/viewport?west=4&south=52&east=5&north=91')->assertUnprocessable()->assertJsonValidationErrors('north');
    $this->getJson('/map/parking/viewport?west=4&south=52&east=5&north=53&limit=501')->assertUnprocessable()->assertJsonValidationErrors('limit');
});
