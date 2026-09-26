<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * A Web Mercator (slippy map) tile used as a stable, cacheable unit of map discovery.
 */
final readonly class MapTile
{
    public const int MAX_ZOOM = 22;

    public function __construct(public int $zoom, public int $x, public int $y)
    {
        if ($zoom < 0 || $zoom > self::MAX_ZOOM) {
            throw new InvalidArgumentException('Tile zoom must be between 0 and '.self::MAX_ZOOM.'.');
        }

        $size = 2 ** $zoom;
        if ($x < 0 || $x >= $size || $y < 0 || $y >= $size) {
            throw new InvalidArgumentException('Tile coordinates must lie inside the zoom level.');
        }
    }

    public function bounds(): GeoBounds
    {
        return new GeoBounds(
            $this->longitude($this->x),
            $this->latitude($this->y + 1),
            $this->longitude($this->x + 1),
            $this->latitude($this->y),
        );
    }

    public function key(): string
    {
        return "{$this->zoom}/{$this->x}/{$this->y}";
    }

    private function longitude(int $x): float
    {
        return $x / 2 ** $this->zoom * 360 - 180;
    }

    private function latitude(int $y): float
    {
        return rad2deg(atan(sinh(M_PI * (1 - 2 * $y / 2 ** $this->zoom))));
    }
}
