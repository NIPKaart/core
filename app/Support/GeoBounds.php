<?php

namespace App\Support;

use InvalidArgumentException;

final readonly class GeoBounds
{
    public function __construct(public float $west, public float $south, public float $east, public float $north)
    {
        new GeoPoint($south, $west);
        new GeoPoint($north, $east);

        if ($south > $north) {
            throw new InvalidArgumentException('South must not be north of north.');
        }
    }

    public function envelopes(): array
    {
        // A viewport crossing the antimeridian is represented by two rectangles.
        return $this->west <= $this->east
            ? [[$this->west, $this->south, $this->east, $this->north]]
            : [[$this->west, $this->south, 180, $this->north], [-180, $this->south, $this->east, $this->north]];
    }
}
