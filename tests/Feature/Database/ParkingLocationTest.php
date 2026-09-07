<?php

use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use App\Services\ParkingDiscovery;
use App\Support\GeoBounds;
use App\Support\GeoPoint;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

it('derives and updates SRID 4326 points for every parking source', function (string $model) {
    $space = $model::factory()->create(['latitude' => 52.37, 'longitude' => 4.9]);
    $table = $space->getTable();
    $point = DB::table($table)->where('id', $space->id)
        ->selectRaw('ST_SRID(location::geometry) AS srid, ST_X(location::geometry) AS x, ST_Y(location::geometry) AS y')->sole();
    expect($point->srid)->toBe(4326)->and((float) $point->x)->toBe(4.9)->and((float) $point->y)->toBe(52.37);

    // Query-builder writes cover imports/upserts as well as model saves.
    DB::table($table)->where('id', $space->id)->update(['longitude' => 5.1]);
    expect($model::withinRadius(new GeoPoint(52.37, 5.1), 0)->whereKey($space->id)->exists())->toBeTrue()
        ->and($model::withinRadius(new GeoPoint(52.37, 4.9), 100)->whereKey($space->id)->exists())->toBeFalse()
        ->and($space->fresh()->toArray())->not->toHaveKey('location');
})->with([ParkingSpace::class, ParkingMunicipal::class, ParkingOffstreet::class]);

it('rejects invalid stored coordinates instead of silently normalizing them', function () {
    ParkingMunicipal::factory()->create(['latitude' => 91]);
})->throws(QueryException::class);

it('measures metres, includes radius boundaries and orders equal distances by id', function () {
    $origin = new GeoPoint(0, 0);
    foreach (['b', 'a'] as $id) {
        ParkingMunicipal::factory()->create(['id' => $id, 'latitude' => 0, 'longitude' => 0.001]);
    }
    ParkingMunicipal::factory()->create(['id' => 'far', 'latitude' => 0, 'longitude' => 1]);
    $results = ParkingMunicipal::withinRadius($origin, 112)->nearestTo($origin)->get();
    expect($results->pluck('id')->all())->toBe(['a', 'b'])
        ->and((float) $results[0]->distance_metres)->toBeGreaterThan(111.31)->toBeLessThan(111.33)
        ->and(ParkingMunicipal::withinRadius($origin, 111)->count())->toBe(0);
    ParkingMunicipal::factory()->create(['id' => 'same', 'latitude' => 0, 'longitude' => 0]);
    expect(ParkingMunicipal::withinRadius($origin, 0)->sole()->id)->toBe('same');
});

it('queries inclusive rectangular viewports and the antimeridian', function () {
    foreach (['west' => -179, 'east' => 179, 'middle' => 0] as $id => $longitude) {
        ParkingMunicipal::factory()->create(['id' => $id, 'latitude' => 10, 'longitude' => $longitude]);
    }
    expect(ParkingMunicipal::inViewport(new GeoBounds(179, 10, -179, 11))->orderBy('id')->pluck('id')->all())->toBe(['east', 'west'])
        ->and(ParkingMunicipal::inViewport(new GeoBounds(-1, 9, 1, 11))->sole()->id)->toBe('middle');
});

it('combines sources with deterministic identifiers and respects public visibility', function () {
    $point = ['latitude' => 52.37, 'longitude' => 4.9];
    $space = ParkingSpace::factory()->create([...$point, 'status' => 'approved']);
    ParkingSpace::factory()->create([...$point, 'status' => 'pending']);
    ParkingSpace::factory()->create([...$point, 'status' => 'approved', 'deleted_at' => now()]);
    ParkingMunicipal::factory()->create([...$point, 'id' => 'external-1', 'visibility' => true]);
    ParkingMunicipal::factory()->create([...$point, 'visibility' => false]);
    ParkingOffstreet::factory()->create([...$point, 'id' => 'external-1', 'visibility' => true]);
    ParkingOffstreet::factory()->create([...$point, 'visibility' => false]);
    $discovery = new ParkingDiscovery;
    $results = $discovery->withinRadius(new GeoPoint(52.37, 4.9), 10);
    expect($results->pluck('source')->all())->toBe(['community', 'municipal', 'offstreet'])
        ->and($results->pluck('id')->all())->toBe([$space->id, 'external-1', 'external-1'])
        ->and($results->pluck('key')->all())->toBe(['community:'.$space->id, 'municipal:external-1', 'offstreet:external-1'])
        ->and($discovery->withinRadius(new GeoPoint(52.37, 4.9), 10, 1))->toHaveCount(1)
        ->and($discovery->inViewport(new GeoBounds(4.8, 52.3, 5, 52.4)))->toHaveCount(3);
});

it('uses spatial indexes for selective radius and viewport queries', function () {
    $space = ParkingMunicipal::factory()->create();
    DB::statement("INSERT INTO parking_municipal_spaces (id, country_id, province_id, municipality_id, number, latitude, longitude, visibility) SELECT 'plan-' || n, ?, ?, ?, 1, -80 + (n % 160), -170 + (n % 340), true FROM generate_series(1, 10000) AS n", [$space->country_id, $space->province_id, $space->municipality_id]);
    DB::statement('ANALYZE parking_municipal_spaces');
    foreach ([
        [ParkingMunicipal::withinRadius(new GeoPoint(52.37, 4.9), 100), 'parking_municipal_spaces_location_gist'],
        [ParkingMunicipal::inViewport(new GeoBounds(4.899, 52.369, 4.901, 52.371)), 'parking_municipal_spaces_viewport_gist'],
    ] as [$query, $index]) {
        $plan = DB::select('EXPLAIN (FORMAT JSON) '.$query->toSql(), $query->getBindings());
        expect(json_encode($plan))->toContain($index);
    }
});

it('rejects invalid search radii', function (float $radius) {
    ParkingMunicipal::withinRadius(new GeoPoint(0, 0), $radius);
})->with([-1, INF, NAN])->throws(InvalidArgumentException::class);

it('rejects unbounded discovery limits', function () {
    (new ParkingDiscovery)->inViewport(new GeoBounds(-180, -90, 180, 90), 1001);
})->throws(InvalidArgumentException::class);

it('supports future coverage polygons in the same SRID', function () {
    $space = ParkingMunicipal::factory()->create(['latitude' => 52.37, 'longitude' => 4.9]);
    $covered = ParkingMunicipal::whereKey($space->id)
        ->whereRaw('ST_Covers(ST_MakeEnvelope(4.8, 52.3, 5, 52.4, 4326), location::geometry)')->exists();
    expect($covered)->toBeTrue();
});
