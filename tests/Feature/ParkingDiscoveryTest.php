<?php

use App\Enums\ParkingStatus;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use App\Services\ParkingDiscovery;
use App\Support\GeoBounds;
use App\Support\GeoPoint;

test('discovery includes only public records from all three sources', function (string $query) {
    $coordinates = ['latitude' => 52, 'longitude' => 5];
    $community = ParkingSpace::factory()->create([...$coordinates, 'status' => ParkingStatus::APPROVED]);
    ParkingSpace::factory()->create([...$coordinates, 'status' => ParkingStatus::PENDING]);
    ParkingSpace::factory()->create([...$coordinates, 'status' => ParkingStatus::REJECTED]);
    ParkingSpace::factory()->create([...$coordinates, 'status' => ParkingStatus::APPROVED, 'deleted_at' => now()]);
    ParkingMunicipal::factory()->create([...$coordinates, 'id' => 'shared', 'visibility' => true]);
    ParkingOffstreet::factory()->create([...$coordinates, 'id' => 'shared', 'visibility' => true]);
    ParkingMunicipal::factory()->create([...$coordinates, 'visibility' => false]);
    ParkingOffstreet::factory()->create([...$coordinates, 'visibility' => false]);
    ParkingOffstreet::factory()->create(['latitude' => 53, 'longitude' => 6, 'visibility' => true]);

    $discovery = app(ParkingDiscovery::class);
    $results = $query === 'radius'
        ? $discovery->withinRadius(new GeoPoint(52, 5), 200)
        : $discovery->inViewport(new GeoBounds(4.9, 51.9, 5.1, 52.1));

    expect($results->pluck('key')->all())->toBe(['community:'.$community->id, 'municipal:shared', 'offstreet:shared']);
    expect($results->pluck('latitude')->all())->toBe([52.0, 52.0, 52.0]);
    expect($results->pluck('longitude')->all())->toBe([5.0, 5.0, 5.0]);
    expect($results->pluck('distance_metres')->all())->toBe($query === 'radius' ? [0.0, 0.0, 0.0] : [null, null, null]);
})->with(['radius', 'viewport']);

test('discovery sorts by distance before source and ID and then applies its limit', function () {
    ParkingSpace::factory()->create(['latitude' => 52.01, 'longitude' => 5, 'status' => ParkingStatus::APPROVED]);
    ParkingOffstreet::factory()->create(['id' => 'b', 'latitude' => 52, 'longitude' => 5, 'visibility' => true]);
    ParkingOffstreet::factory()->create(['id' => 'a', 'latitude' => 52, 'longitude' => 5, 'visibility' => true]);
    ParkingMunicipal::factory()->create(['id' => 'shared', 'latitude' => 52, 'longitude' => 5, 'visibility' => true]);

    $results = app(ParkingDiscovery::class)->withinRadius(new GeoPoint(52, 5), 2000, 3);

    expect($results->pluck('key')->all())->toBe(['municipal:shared', 'offstreet:a', 'offstreet:b']);
});

test('discovery rejects limits outside its supported range', function (int $limit, string $query) {
    $discovery = app(ParkingDiscovery::class);

    expect(fn () => $query === 'radius'
        ? $discovery->withinRadius(new GeoPoint(52, 5), 200, $limit)
        : $discovery->inViewport(new GeoBounds(4, 51, 6, 53), $limit)
    )->toThrow(InvalidArgumentException::class);
})->with([0, 1001])->with(['radius', 'viewport']);
