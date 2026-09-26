<?php

use App\Enums\ParkingStatus;
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

    $this->getJson('/api/parking/nearby?latitude=52.36&longitude=4.88&radius=500')
        ->assertOk()
        ->assertJsonCount(1, 'results')
        ->assertJsonPath('results.0.key', 'community:'.$near->id)
        ->assertJsonPath('results.0.distance_metres', 0);
});

test('nearby parking discovery validates coordinates radius and limit', function () {
    $this->getJson('/api/parking/nearby?latitude=91&longitude=4.88')->assertUnprocessable()->assertJsonValidationErrors('latitude');
    $this->getJson('/api/parking/nearby?latitude=52&longitude=181')->assertUnprocessable()->assertJsonValidationErrors('longitude');
    $this->getJson('/api/parking/nearby?latitude=52&longitude=5&radius=20')->assertUnprocessable()->assertJsonValidationErrors('radius');
    $this->getJson('/api/parking/nearby?latitude=52&longitude=5&limit=201')->assertUnprocessable()->assertJsonValidationErrors('limit');
});
