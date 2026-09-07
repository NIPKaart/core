<?php

namespace App\Support;

use InvalidArgumentException;

final readonly class GeoPoint
{
    public function __construct(public float $latitude, public float $longitude)
    {
        if (! is_finite($latitude) || ! is_finite($longitude) || abs($latitude) > 90 || abs($longitude) > 180) {
            throw new InvalidArgumentException('Latitude must be between -90 and 90 and longitude between -180 and 180.');
        }
    }

    public function bindings(): array
    {
        // PostGIS X/Y order is longitude, latitude.
        return [$this->longitude, $this->latitude];
    }
}
