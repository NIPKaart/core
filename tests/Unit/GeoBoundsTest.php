<?php

use App\Support\GeoBounds;

mutates(GeoBounds::class);

test('bounds reject invalid edges and reversed latitude ranges', function (float $west, float $south, float $east, float $north) {
    expect(fn () => new GeoBounds($west, $south, $east, $north))->toThrow(InvalidArgumentException::class);
})->with([
    'reversed latitudes' => [4, 53, 5, 52],
    'west out of range' => [-181, 52, 5, 53],
    'east out of range' => [4, 52, 181, 53],
    'south out of range' => [4, -91, 5, 53],
    'north out of range' => [4, 52, 5, 91],
    'non finite west' => [NAN, 52, 5, 53],
    'non finite south' => [4, -INF, 5, 53],
    'non finite east' => [4, 52, INF, 53],
    'non finite north' => [4, 52, 5, NAN],
]);

test('bounds accept a viewport of a single latitude', function () {
    expect((new GeoBounds(4, 52, 5, 52))->envelopes())->toBe([[4.0, 52.0, 5.0, 52.0]]);
});

test('bounds west of east form one envelope', function (float $west, float $east) {
    expect((new GeoBounds($west, 52, $east, 53))->envelopes())->toBe([[$west, 52.0, $east, 53.0]]);
})->with([
    'regular viewport' => [4, 5],
    'single longitude' => [4, 4],
]);

test('bounds crossing the antimeridian split into envelopes on both sides', function () {
    expect((new GeoBounds(179, -1, -179, 1))->envelopes())->toBe([
        [179.0, -1.0, 180, 1.0],
        [-180, -1.0, -179.0, 1.0],
    ]);
});
