<?php

use App\Support\GeoBounds;

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
