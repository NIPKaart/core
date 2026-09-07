<?php

use App\Enums\ParkingStatus;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use Illuminate\Support\Facades\Notification;

test('blank search returns no parking records', function () {
    $this->getJson('/api/search?q=')->assertExactJson(['hits' => [], 'estimatedTotalHits' => 0]);
});

test('guests search all sources with labels and map coordinates', function () {
    $place = Municipality::factory()->create(['name' => 'Amsterdam']);
    ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'street' => 'Canal community', 'city' => 'Amsterdam', 'latitude' => 52.1, 'longitude' => 4.2]);
    ParkingOffstreet::factory()->for($place)->create(['name' => 'Canal garage', 'visibility' => true]);
    ParkingMunicipal::factory()->for($place)->create(['street' => 'Canal municipal', 'number' => 2, 'visibility' => true]);

    $this->getJson('/api/search?q=Canal')->assertOk()->assertJsonPath('estimatedTotalHits', 3)
        ->assertJsonPath('hits.0.type', 'community')->assertJsonPath('hits.0.lat', 52.1)->assertJsonPath('hits.0.lng', 4.2)
        ->assertJsonPath('hits.0.href', route('location-map'))
        ->assertJsonPath('hits.1.type', 'offstreet')->assertJsonPath('hits.1.href', route('garages'))
        ->assertJsonPath('hits.2.label', 'Canal municipal 2')->assertJsonPath('hits.2.sub', 'Amsterdam');
});

test('place and postcode filters preserve source specific search', function (string $postcode) {
    $place = Municipality::factory()->create(['name' => 'Amsterdam']);
    $space = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'street' => 'Canal', 'city' => 'Amsterdam', 'postcode' => '1234 AB']);
    ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'street' => 'Canal', 'city' => 'Amsterdam', 'postcode' => '9999 ZZ']);
    ParkingMunicipal::factory()->for($place)->create(['street' => 'Canal', 'visibility' => true]);
    ParkingOffstreet::factory()->for($place)->create(['name' => 'Canal', 'visibility' => true]);

    $this->getJson('/api/search?q='.urlencode('aMsTeRdAm, Canal '.$postcode))
        ->assertJsonPath('estimatedTotalHits', 3);
    $this->getJson('/api/search?q='.urlencode($postcode))->assertJsonCount(1, 'hits')->assertJsonPath('hits.0.id', $space->id);
})->with(['1234ab', '1234 AB']);

test('search supports partial words and misspellings with exact matches first', function () {
    ParkingOffstreet::factory()->create(['name' => 'Keizersgracht', 'visibility' => true, 'id' => 'exact']);
    ParkingOffstreet::factory()->create(['name' => 'Keizergracht', 'visibility' => true, 'id' => 'typo']);

    $this->getJson('/api/search?q=Keizersgracht')->assertJsonCount(2, 'hits')->assertJsonPath('hits.0.id', 'exact');
    $this->getJson('/api/search?q=Keizers')->assertJsonPath('hits.0.id', 'exact');
});

test('unpublished hidden and deleted records never appear', function () {
    Notification::fake();
    ParkingSpace::factory()->create(['street' => 'Canal', 'status' => ParkingStatus::PENDING]);
    ParkingSpace::factory()->create(['street' => 'Canal', 'status' => ParkingStatus::APPROVED])->delete();
    ParkingMunicipal::factory()->create(['street' => 'Canal', 'visibility' => false]);
    ParkingOffstreet::factory()->create(['name' => 'Canal', 'visibility' => false]);

    $this->getJson('/api/search?q=Canal')->assertExactJson(['hits' => [], 'estimatedTotalHits' => 0]);
});

test('search sees record and related geography updates without synchronization', function () {
    $place = Municipality::factory()->create(['name' => 'Beforetown']);
    $space = ParkingOffstreet::factory()->for($place)->create(['name' => 'Initial', 'visibility' => true]);
    $space->name = 'Replacement';
    $space->save();
    $place->update(['name' => 'Aftertown']);

    $this->getJson('/api/search?q=Aftertown,%20Replacement')->assertJsonPath('hits.0.id', $space->id);
    $this->getJson('/api/search?q=Beforetown,%20Replacement')->assertJsonCount(0, 'hits');
});

test('literal wildcard and SQL input cannot broaden the result set', function (string $text) {
    ParkingOffstreet::factory()->create(['name' => 'Canal', 'visibility' => true]);

    $this->getJson('/api/search?q='.urlencode($text))->assertJsonCount(0, 'hits');
})->with(['%', '_', "' OR 1=1 --", '\\']);

test('limits and source identity are deterministic', function () {
    $place = Municipality::factory()->create(['name' => 'Amsterdam']);
    ParkingOffstreet::factory()->for($place)->create(['id' => 'shared', 'name' => 'Canal 2', 'visibility' => true]);
    ParkingMunicipal::factory()->for($place)->create(['id' => 'shared', 'street' => 'Canal', 'number' => 2, 'visibility' => true]);
    ParkingOffstreet::factory()->for($place)->create(['id' => 'third', 'name' => 'Canal 2', 'visibility' => true]);

    $this->getJson('/api/search?q=Canal&limit=1')->assertJsonCount(2, 'hits')->assertJsonPath('estimatedTotalHits', 3)
        ->assertJsonPath('hits.0.type', 'municipal')->assertJsonPath('hits.1.type', 'offstreet');
    $this->getJson('/api/search?q=Canal&limit=0')->assertJsonCount(2, 'hits');
});

test('invalid or excessive queries return validation errors', function (array $query, string $field) {
    $this->getJson('/api/search?'.http_build_query($query))->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    [['q' => ['Canal']], 'q'],
    [['q' => str_repeat('x', 201)], 'q'],
    [['q' => 'Canal', 'limit' => 'invalid'], 'limit'],
]);

test('community descriptive fields remain searchable', function (string $field) {
    $space = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, $field => 'Distinctiveword']);

    $this->getJson('/api/search?q=Distinctiveword')->assertJsonCount(1, 'hits')->assertJsonPath('hits.0.id', $space->id);
})->with(['street', 'city', 'suburb', 'neighbourhood', 'amenity', 'description']);

test('imported URLs and province names remain searchable', function () {
    $space = ParkingOffstreet::factory()->create(['visibility' => true, 'url' => 'https://example.org/unique-facility']);
    $space->province->update(['name' => 'Distinctiveprovince']);

    $this->getJson('/api/search?q=unique-facility')->assertJsonPath('hits.0.id', $space->id);
    $this->getJson('/api/search?q=Distinctiveprovince')->assertJsonPath('hits.0.id', $space->id);
});

test('a separator alone does not list every published record', function () {
    ParkingOffstreet::factory()->create(['visibility' => true]);

    $this->getJson('/api/search?q=,')->assertExactJson(['hits' => [], 'estimatedTotalHits' => 0]);
});
