<?php

use App\Enums\ParkingStatus;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;

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
