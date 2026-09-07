<?php

use App\Support\GeoBounds;
use App\Support\GeoPoint;

it('rejects invalid destination coordinates', function (float $latitude, float $longitude) {
    new GeoPoint($latitude, $longitude);
})->with([[91, 0], [0, 181], [NAN, 0], [0, INF]])->throws(InvalidArgumentException::class);

it('rejects inverted north and south bounds', function () {
    new GeoBounds(0, 20, 10, 10);
})->throws(InvalidArgumentException::class);
