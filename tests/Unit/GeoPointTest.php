<?php

use App\Support\GeoPoint;

test('coordinates reject values outside geographic ranges and non finite values', function (float $latitude, float $longitude) {
    expect(fn () => new GeoPoint($latitude, $longitude))->toThrow(InvalidArgumentException::class);
})->with([
    'south of pole' => [-90.1, 0],
    'north of pole' => [90.1, 0],
    'west out of range' => [0, -180.1],
    'east out of range' => [0, 180.1],
    'infinite latitude' => [INF, 0],
    'infinite longitude' => [0, -INF],
    'nan latitude' => [NAN, 0],
    'nan longitude' => [0, NAN],
]);

test('coordinate extremes remain valid in longitude latitude binding order', function () {
    expect((new GeoPoint(-90, 180))->bindings())->toBe([180.0, -90.0]);
    expect((new GeoPoint(90, -180))->bindings())->toBe([-180.0, 90.0]);
});
