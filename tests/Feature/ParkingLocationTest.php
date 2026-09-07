<?php

use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use App\Support\GeoBounds;
use App\Support\GeoPoint;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

dataset('parking models', [ParkingSpace::class, ParkingMunicipal::class, ParkingOffstreet::class]);

test('scalar writes generate valid longitude latitude locations and keep them out of JSON', function (string $model) {
    $space = $model::factory()->create(['latitude' => 52.37, 'longitude' => 4.9]);

    $location = $model::whereKey($space->id)->selectRaw('ST_SRID(location::geometry) AS srid, ST_X(location::geometry) AS x, ST_Y(location::geometry) AS y, ST_IsValid(location::geometry) AS valid')->first();

    expect($location->srid)->toBe(4326);
    expect((float) $location->x)->toBe(4.9);
    expect((float) $location->y)->toBe(52.37);
    expect($location->valid)->toBeTrue();
    expect($space->fresh()->toArray())->not->toHaveKey('location');

    DB::table($space->getTable())->where('id', $space->id)->update(['longitude' => 5.1, 'latitude' => 51.9]);

    expect($model::withinRadius(new GeoPoint(51.9, 5.1), 0)->pluck('id')->all())->toBe([$space->id]);
    expect($model::withinRadius(new GeoPoint(52.37, 4.9), 100)->exists())->toBeFalse();
})->with('parking models');

test('radius queries use metres and nearest ordering breaks equal distances by ID', function (string $model) {
    $origin = new GeoPoint(52, 5);
    $far = $model::factory()->create(['latitude' => 52.01, 'longitude' => 5]);
    $near = $model::factory()->create(['latitude' => 52.001, 'longitude' => 5]);
    $tied = $model::factory()->create(['latitude' => 52.001, 'longitude' => 5]);
    $atOrigin = $model::factory()->create(['latitude' => 52, 'longitude' => 5]);
    $tieIds = collect([$near->id, $tied->id])->sort()->values()->all();

    $results = $model::withinRadius($origin, 200)->orderByDesc('id')->nearestTo($origin)->get();

    expect($results->modelKeys())->toBe([$atOrigin->id, ...$tieIds]);
    expect((float) $results[0]->distance_metres)->toBe(0.0);
    expect((float) $results[1]->distance_metres)->toBeBetween(110.0, 112.0);
    expect($model::nearestTo($origin)->get()->last()->id)->toBe($far->id);
})->with('parking models');

test('viewports include every edge and exclude points just outside', function (string $model) {
    $inside = $model::factory()->count(5)->sequence(
        ['longitude' => 4, 'latitude' => 52.5],
        ['longitude' => 5, 'latitude' => 52.5],
        ['longitude' => 4.5, 'latitude' => 52],
        ['longitude' => 4.5, 'latitude' => 53],
        ['longitude' => 4.5, 'latitude' => 52.5],
    )->create();
    $model::factory()->count(4)->sequence(
        ['longitude' => 3.999, 'latitude' => 52.5],
        ['longitude' => 5.001, 'latitude' => 52.5],
        ['longitude' => 4.5, 'latitude' => 51.999],
        ['longitude' => 4.5, 'latitude' => 53.001],
    )->create();

    $results = $model::inViewport(new GeoBounds(4, 52, 5, 53))->get();

    expect($results->modelKeys())->toEqualCanonicalizing($inside->modelKeys());
})->with('parking models');

test('antimeridian viewports include both sides without including Greenwich', function (string $model) {
    $inside = $model::factory()->count(4)->sequence(
        ['longitude' => 179, 'latitude' => 0],
        ['longitude' => -179, 'latitude' => 0],
        ['longitude' => 180, 'latitude' => 0],
        ['longitude' => -180, 'latitude' => 0],
    )->create();
    $model::factory()->create(['longitude' => 0, 'latitude' => 0]);

    $results = $model::inViewport(new GeoBounds(179, -1, -179, 1))->get();

    expect($results->modelKeys())->toEqualCanonicalizing($inside->modelKeys());
})->with('parking models');

test('database rejects invalid scalar coordinates from bulk writers', function (string $model, string $coordinate, float $value) {
    $space = $model::factory()->create(['latitude' => 52, 'longitude' => 5]);

    expect(fn () => DB::table($space->getTable())->where('id', $space->id)->update([$coordinate => $value]))
        ->toThrow(QueryException::class, '23514');
})->with('parking models')->with([
    'latitude too low' => ['latitude', -91],
    'latitude too high' => ['latitude', 91],
    'longitude too low' => ['longitude', -181],
    'longitude too high' => ['longitude', 181],
]);

test('radius queries reject negative and non finite distances', function (string $model, float $radius) {
    expect(fn () => $model::withinRadius(new GeoPoint(52, 5), $radius)->get())->toThrow(InvalidArgumentException::class);
})->with('parking models')->with(['negative' => -1, 'infinity' => INF, 'not a number' => NAN]);
