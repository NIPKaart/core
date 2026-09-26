<?php

use App\Enums\ParkingStatus;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use App\Services\ParkingTextSearch;
use Illuminate\Support\Facades\Notification;

test('blank search returns no parking records', function () {
    $result = app(ParkingTextSearch::class)->search('', 10);
    expect($result)->toBe(['hits' => [], 'estimatedTotalHits' => 0]);
});

test('parking search includes all sources with labels and map coordinates', function () {
    $place = Municipality::factory()->create(['name' => 'Amsterdam']);
    ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'street' => 'Canal community', 'city' => 'Amsterdam', 'latitude' => 52.1, 'longitude' => 4.2]);
    ParkingOffstreet::factory()->for($place)->create(['name' => 'Canal garage', 'visibility' => true]);
    ParkingMunicipal::factory()->for($place)->create(['street' => 'Canal municipal', 'number' => 2, 'visibility' => true]);

    $result = app(ParkingTextSearch::class)->search('Canal', 10);
    expect($result['estimatedTotalHits'])->toBe(3);
    expect($result['hits'][0]['type'])->toBe('community');
    expect($result['hits'][0]['lat'])->toBe(52.1);
    expect($result['hits'][0]['lng'])->toBe(4.2);
    expect($result['hits'][0]['href'])->toBe(route('location-map'));
    expect($result['hits'][1]['type'])->toBe('offstreet');
    expect($result['hits'][1]['href'])->toBe(route('garages'));
    expect($result['hits'][2]['label'])->toBe('Canal municipal 2');
    expect($result['hits'][2]['sub'])->toBe('Amsterdam');
});

test('place and postcode filters preserve source specific search', function (string $postcode) {
    $place = Municipality::factory()->create(['name' => 'Amsterdam']);
    $space = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'street' => 'Canal', 'city' => 'Amsterdam', 'postcode' => '1234 AB']);
    ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'street' => 'Canal', 'city' => 'Amsterdam', 'postcode' => '9999 ZZ']);
    ParkingMunicipal::factory()->for($place)->create(['street' => 'Canal', 'visibility' => true]);
    ParkingOffstreet::factory()->for($place)->create(['name' => 'Canal', 'visibility' => true]);

    $result = app(ParkingTextSearch::class)->search('aMsTeRdAm, Canal '.$postcode, 10);
    expect($result['estimatedTotalHits'])->toBe(3);
    $result = app(ParkingTextSearch::class)->search($postcode, 10);
    expect($result['hits'])->toHaveCount(1);
    expect($result['hits'][0]['id'])->toBe($space->id);
})->with(['1234ab', '1234 AB']);

test('search supports partial words and misspellings with exact matches first', function () {
    ParkingOffstreet::factory()->create(['name' => 'Keizersgracht', 'visibility' => true, 'id' => 'exact']);
    ParkingOffstreet::factory()->create(['name' => 'Keizergracht', 'visibility' => true, 'id' => 'typo']);

    $result = app(ParkingTextSearch::class)->search('Keizersgracht', 10);
    expect($result['hits'])->toHaveCount(2);
    expect($result['hits'][0]['id'])->toBe('exact');
    $result = app(ParkingTextSearch::class)->search('Keizers', 10);
    expect($result['hits'][0]['id'])->toBe('exact');
});

test('unpublished hidden and deleted records never appear', function () {
    Notification::fake();
    ParkingSpace::factory()->create(['street' => 'Canal', 'status' => ParkingStatus::PENDING]);
    ParkingSpace::factory()->create(['street' => 'Canal', 'status' => ParkingStatus::APPROVED])->delete();
    ParkingMunicipal::factory()->create(['street' => 'Canal', 'visibility' => false]);
    ParkingOffstreet::factory()->create(['name' => 'Canal', 'visibility' => false]);

    $result = app(ParkingTextSearch::class)->search('Canal', 10);
    expect($result)->toBe(['hits' => [], 'estimatedTotalHits' => 0]);
});

test('search sees record and related geography updates without synchronization', function () {
    $place = Municipality::factory()->create(['name' => 'Beforetown']);
    $space = ParkingOffstreet::factory()->for($place)->create(['name' => 'Initial', 'visibility' => true]);
    $space->name = 'Replacement';
    $space->save();
    $place->update(['name' => 'Aftertown']);

    $result = app(ParkingTextSearch::class)->search('Aftertown, Replacement', 10);
    expect($result['hits'][0]['id'])->toBe($space->id);
    $result = app(ParkingTextSearch::class)->search('Beforetown, Replacement', 10);
    expect($result['hits'])->toHaveCount(0);
});

test('literal wildcard and SQL input cannot broaden the result set', function (string $text) {
    ParkingOffstreet::factory()->create(['name' => 'Canal', 'visibility' => true]);

    $result = app(ParkingTextSearch::class)->search($text, 10);
    expect($result['hits'])->toHaveCount(0);
})->with(['%', '_', "' OR 1=1 --", '\\']);

test('limits and source identity are deterministic', function () {
    $place = Municipality::factory()->create(['name' => 'Amsterdam']);
    ParkingOffstreet::factory()->for($place)->create(['id' => 'shared', 'name' => 'Canal 2', 'visibility' => true]);
    ParkingMunicipal::factory()->for($place)->create(['id' => 'shared', 'street' => 'Canal', 'number' => 2, 'visibility' => true]);
    ParkingOffstreet::factory()->for($place)->create(['id' => 'third', 'name' => 'Canal 2', 'visibility' => true]);

    $result = app(ParkingTextSearch::class)->search('Canal', 1);
    expect($result['hits'])->toHaveCount(2);
    expect($result['estimatedTotalHits'])->toBe(3);
    expect($result['hits'][0]['type'])->toBe('municipal');
    expect($result['hits'][1]['type'])->toBe('offstreet');
    $result = app(ParkingTextSearch::class)->search('Canal', 0);
    expect($result['hits'])->toHaveCount(2);
});

test('community descriptive fields remain searchable', function (string $field) {
    $space = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, $field => 'Distinctiveword']);

    $result = app(ParkingTextSearch::class)->search('Distinctiveword', 10);
    expect($result['hits'])->toHaveCount(1);
    expect($result['hits'][0]['id'])->toBe($space->id);
})->with(['street', 'city', 'suburb', 'neighbourhood', 'amenity', 'description']);

test('imported URLs and province names remain searchable', function () {
    $space = ParkingOffstreet::factory()->create(['visibility' => true, 'url' => 'https://example.org/unique-facility']);
    $space->province->update(['name' => 'Distinctiveprovince']);

    $result = app(ParkingTextSearch::class)->search('unique-facility', 10);
    expect($result['hits'][0]['id'])->toBe($space->id);
    $result = app(ParkingTextSearch::class)->search('Distinctiveprovince', 10);
    expect($result['hits'][0]['id'])->toBe($space->id);
});

test('a separator alone does not list every published record', function () {
    ParkingOffstreet::factory()->create(['visibility' => true]);

    $result = app(ParkingTextSearch::class)->search(',', 10);
    expect($result)->toBe(['hits' => [], 'estimatedTotalHits' => 0]);
});
