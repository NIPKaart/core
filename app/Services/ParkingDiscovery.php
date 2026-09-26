<?php

namespace App\Services;

use App\Enums\ParkingStatus;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use App\Support\GeoBounds;
use App\Support\GeoPoint;
use App\Support\MapTile;
use App\Support\ParkingResult;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class ParkingDiscovery
{
    /** Records are loaded per area tile at this zoom (roughly 50 by 80 km in the Netherlands). */
    public const int AREA_ZOOM = 9;

    public const int AREA_POINT_LIMIT = 100000;

    public function withinRadius(GeoPoint $origin, float $metres, int $limit = 100): Collection
    {
        return $this->query(fn (Builder $query) => $query->withinRadius($origin, $metres)->withDistanceFrom($origin), $limit, true);
    }

    /** Distance is measured from $distanceFrom when given; ordering stays source-and-identifier based. */
    public function inViewport(GeoBounds $bounds, int $limit = 100, int $offset = 0, ?GeoPoint $distanceFrom = null): Collection
    {
        return $this->query(
            fn (Builder $query) => $distanceFrom ? $query->inViewport($bounds)->withDistanceFrom($distanceFrom) : $query->inViewport($bounds),
            $limit,
            $distanceFrom !== null,
            $offset,
            orderByDistance: false,
        );
    }

    private function query(callable $filter, int $limit, bool $withDistance, int $offset = 0, bool $orderByDistance = true): Collection
    {
        if ($limit < 1 || $limit > 1000) {
            throw new InvalidArgumentException('Result limit must be between 1 and 1000.');
        }

        if ($offset < 0) {
            throw new InvalidArgumentException('Result offset must not be negative.');
        }

        $query = $this->publicParking($filter, $withDistance);
        if ($withDistance && $orderByDistance) {
            $query->orderBy('distance_metres');
        }

        return $query->orderBy('source')->orderBy('id')->offset($offset)->limit($limit)->get()->map(ParkingResult::fromDatabaseRow(...));
    }

    /**
     * Area tiles that contain public parking, with their record counts, so browsers never request empty areas.
     * Cells follow the same half-open tile edges as area(), so each record is counted in the area that returns it.
     *
     * @return list<array{0: int, 1: int, 2: int}>
     */
    public function areaIndex(): array
    {
        $tilesPerSide = 2 ** self::AREA_ZOOM;

        return DB::query()
            ->fromSub($this->publicParking(fn (Builder $query) => $query, false), 'parking_options')
            ->selectRaw(
                'FLOOR((longitude + 180) / 360 * ?)::int AS x, FLOOR((1 - LN(TAN(RADIANS(latitude)) + 1 / COS(RADIANS(latitude))) / PI()) / 2 * ?)::int AS y, COUNT(*) AS count',
                [$tilesPerSide, $tilesPerSide],
            )
            ->groupBy('x', 'y')
            ->orderBy('y')
            ->orderBy('x')
            ->get()
            ->map(fn (object $row): array => [(int) $row->x, (int) $row->y, (int) $row->count])
            ->all();
    }

    /**
     * Every public record inside an area tile, so browsers can cluster it at any zoom without further requests.
     *
     * @return array{points: list<ParkingResult>, truncated: bool}
     */
    public function area(MapTile $area): array
    {
        if ($area->zoom !== self::AREA_ZOOM) {
            throw new InvalidArgumentException('Areas use zoom '.self::AREA_ZOOM.'.');
        }

        $points = $this->insideTile($area)->orderBy('source')->orderBy('id')->limit(self::AREA_POINT_LIMIT + 1)->get()->map(ParkingResult::fromDatabaseRow(...));

        return ['points' => $points->take(self::AREA_POINT_LIMIT)->values()->all(), 'truncated' => $points->count() > self::AREA_POINT_LIMIT];
    }

    /**
     * Published records inside a tile. Half-open edges keep a record on a shared tile edge in exactly one tile.
     */
    private function insideTile(MapTile $tile): QueryBuilder
    {
        $bounds = $tile->bounds();

        return $this->publicParking(fn (Builder $query) => $query->inViewport($bounds), false)
            ->where('longitude', '>=', $bounds->west)
            ->where('longitude', '<', $bounds->east)
            ->where('latitude', '>', $bounds->south)
            ->where('latitude', '<=', $bounds->north);
    }

    /**
     * The published records of all three sources as one source-qualified union.
     */
    private function publicParking(callable $filter, bool $withDistance): QueryBuilder
    {
        $union = null;
        foreach (['community' => ParkingSpace::class, 'municipal' => ParkingMunicipal::class, 'offstreet' => ParkingOffstreet::class] as $source => $model) {
            $query = $model::query()->selectRaw("id::text AS id, ?::text AS source, (? || ':' || id::text) AS key, latitude::double precision AS latitude, longitude::double precision AS longitude", [$source, $source]);
            $query->selectRaw($source === 'offstreet' ? 'name AS title' : "COALESCE(street, '') AS title");
            $source === 'community' ? $query->where('status', ParkingStatus::APPROVED) : $query->where('visibility', true);
            $filter($query);
            if (! $withDistance) {
                $query->selectRaw('NULL::double precision AS distance_metres');
            }
            // toBase applies Eloquent's soft-delete scope before combining sources.
            $branch = $query->toBase();
            $union = $union === null ? $branch : $union->unionAll($branch);
        }

        return DB::query()->fromSub($union, 'parking_options');
    }
}
