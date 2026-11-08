<?php

namespace App\Services;

use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingStatus;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use App\Support\GeoBounds;
use App\Support\GeoPoint;
use App\Support\MapTile;
use App\Support\ParkingResult;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class ParkingDiscovery
{
    /** Records are loaded per area tile at this zoom (roughly 50 by 80 km in the Netherlands). */
    public const int AREA_ZOOM = 9;

    public const int AREA_POINT_LIMIT = 100000;

    /**
     * Public source records, not deduplicated physical places or individual bays.
     *
     * @return array{parking_locations: int, garages: int, municipalities: int, countries: int}
     */
    public function statistics(): array
    {
        return Cache::remember('parking.public-statistics.v1', 300, function (): array {
            $counts = $this->publicParking(fn (Builder $query) => $query, false)
                ->selectRaw("COUNT(*) FILTER (WHERE source != 'offstreet') AS parking_locations")
                ->selectRaw("COUNT(*) FILTER (WHERE source = 'offstreet') AS garages")
                ->selectRaw('COUNT(DISTINCT municipality_id) AS municipalities, COUNT(DISTINCT country_id) AS countries')
                ->first();

            return [
                'parking_locations' => (int) $counts->parking_locations,
                'garages' => (int) $counts->garages,
                'municipalities' => (int) $counts->municipalities,
                'countries' => (int) $counts->countries,
            ];
        });
    }

    /**
     * Public parking per municipality, under the same publication rules as the map: approved community spaces and
     * visible municipal and offstreet records. Street spaces count per source record, as the map shows them; garages
     * and P+R facilities count separately. Visible municipal records are verified by their source; community records need an existence confirmation.
     *
     * @return array<int, array{country_id: int, province_id: ?int, community: int, municipal: int, verified: int, last_confirmed_at: ?string, garages: int, park_and_ride: int, live_garages: int, live_park_and_ride: int, observed_at: ?string}>
     */
    public function municipalityTotals(): array
    {
        return Cache::remember('parking.municipality-totals.v2', 300, function (): array {
            $empty = ['community' => 0, 'municipal' => 0, 'verified' => 0, 'last_confirmed_at' => null, 'garages' => 0, 'park_and_ride' => 0, 'live_garages' => 0, 'live_park_and_ride' => 0, 'observed_at' => null];
            $totals = [];
            $add = function (object $row) use (&$totals, $empty): string {
                $totals[$row->municipality_id] ??= ['country_id' => (int) $row->country_id, 'province_id' => $row->province_id === null ? null : (int) $row->province_id, ...$empty];

                return (string) $row->municipality_id;
            };

            foreach (['community' => ParkingSpace::class, 'municipal' => ParkingMunicipal::class] as $source => $model) {
                $places = $this->publishedStreetPlaces($source, $model);
                $places->clone()->selectRaw('municipality_id, country_id, province_id, COUNT(*) AS total')->groupBy('municipality_id', 'country_id', 'province_id')->get()
                    ->each(function (object $row) use (&$totals, $add, $source): void {
                        $key = $add($row);
                        $totals[$key][$source] += (int) $row->total;
                        if ($source === 'municipal') {
                            $totals[$key]['verified'] += (int) $row->total;
                        }
                    });

                $foreignKey = $source === 'community' ? 'parking_space_id' : 'parking_municipal_id';
                $confirmations = DB::query()->fromSub($places->select(['id', 'municipality_id']), 'places')
                    ->join('parking_space_confirmations as confirmation', "confirmation.{$foreignKey}", '=', 'places.id')
                    ->where('confirmation.status', ParkingConfirmationStatus::CONFIRMED->value)
                    ->selectRaw('places.municipality_id, MAX(confirmation.confirmed_at) AS last_confirmed_at')
                    ->groupBy('places.municipality_id');

                if ($source === 'community') {
                    $confirmations->selectRaw('COUNT(DISTINCT places.id) AS confirmed');
                }

                $confirmations->get()
                    ->each(function (object $row) use (&$totals, $source): void {
                        if ($source === 'community') {
                            $totals[$row->municipality_id]['verified'] += (int) $row->confirmed;
                        }
                        $totals[$row->municipality_id]['last_confirmed_at'] = max($totals[$row->municipality_id]['last_confirmed_at'], CarbonImmutable::parse($row->last_confirmed_at)->toISOString());
                    });
            }

            ParkingOffstreet::query()->where('visibility', true)
                ->get(['id', 'municipality_id', 'country_id', 'province_id', 'parking_type', 'observed_at', 'api_state', 'occupancy_status', 'free_space'])
                ->each(function (ParkingOffstreet $facility) use (&$totals, $add): void {
                    $key = $add($facility);
                    $kind = $facility->parking_type === 'parkandride' ? 'park_and_ride' : 'garages';
                    $totals[$key][$kind]++;
                    if ($facility->availability() === 'current') {
                        $totals[$key]['live_'.$kind]++;
                        $totals[$key]['observed_at'] = max($totals[$key]['observed_at'], $facility->observed_at?->toISOString());
                    }
                });

            return $totals;
        });
    }

    /**
     * Where the public parking of an area lies, with nearby records grouped, for a still preview of the map.
     *
     * @param  'country_id'|'province_id'|'municipality_id'  $column
     * @return array{bounds: array{south: float, north: float, west: float, east: float}, clusters: list<array{latitude: float, longitude: float, count: int}>}|null
     */
    public function areaPreview(string $column, int $id): ?array
    {
        if (! in_array($column, ['country_id', 'province_id', 'municipality_id'], true)) {
            throw new InvalidArgumentException('Unsupported area column.');
        }

        return Cache::remember("parking.area-preview.v1.{$column}.{$id}", 300, function () use ($column, $id): ?array {
            $records = $this->publicParking(fn (Builder $query) => $query->where($column, $id), false);
            $extent = DB::query()->fromSub($records, 'records')
                ->selectRaw('MIN(latitude) AS south, MAX(latitude) AS north, MIN(longitude) AS west, MAX(longitude) AS east, COUNT(*) AS total')
                ->first();
            if ((int) $extent->total === 0) {
                return null;
            }

            $cell = max(((float) $extent->north - (float) $extent->south) / 6, ((float) $extent->east - (float) $extent->west) / 9, 0.002);
            $clusters = DB::query()->fromSub($this->publicParking(fn (Builder $query) => $query->where($column, $id), false), 'records')
                ->selectRaw('AVG(latitude) AS latitude, AVG(longitude) AS longitude, COUNT(*) AS count')
                ->groupByRaw('FLOOR(latitude / ?), FLOOR(longitude / ?)', [$cell, $cell])
                ->orderByDesc('count')
                ->limit(80)
                ->get()
                ->map(fn (object $cluster): array => ['latitude' => (float) $cluster->latitude, 'longitude' => (float) $cluster->longitude, 'count' => (int) $cluster->count])
                ->all();

            return [
                'bounds' => ['south' => (float) $extent->south, 'north' => (float) $extent->north, 'west' => (float) $extent->west, 'east' => (float) $extent->east],
                'clusters' => $clusters,
            ];
        });
    }

    /**
     * The published records of one street-space source, under the map's publication rules.
     *
     * @param  class-string<ParkingSpace|ParkingMunicipal>  $model
     */
    private function publishedStreetPlaces(string $source, string $model): QueryBuilder
    {
        $query = $model::query();
        $source === 'community' ? $query->where('status', ParkingStatus::APPROVED) : $query->where('visibility', true);

        // toBase applies Eloquent's soft-delete scope.
        return $query->toBase();
    }

    public function withinRadius(GeoPoint $origin, float $metres, int $limit = 100, int $offset = 0, string $source = 'all', string $sort = 'distance'): Collection
    {
        return $this->query(fn (Builder $query) => $query->withinRadius($origin, $metres)->withDistanceFrom($origin), $limit, true, $offset, source: $source, sort: $sort);
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

    private function query(callable $filter, int $limit, bool $withDistance, int $offset = 0, bool $orderByDistance = true, string $source = 'all', string $sort = 'distance'): Collection
    {
        if ($limit < 1 || $limit > 1000) {
            throw new InvalidArgumentException('Result limit must be between 1 and 1000.');
        }

        if ($offset < 0) {
            throw new InvalidArgumentException('Result offset must not be negative.');
        }

        if (! in_array($source, ['all', 'community', 'municipal', 'offstreet'], true) || ! in_array($sort, ['distance', 'balanced'], true)) {
            throw new InvalidArgumentException('Unsupported discovery source or sort.');
        }

        $query = $this->publicParking($filter, $withDistance);
        if ($source !== 'all') {
            $query->where('source', $source);
        }
        if ($withDistance && $orderByDistance) {
            if ($sort === 'balanced') {
                $query->orderByRaw("distance_metres + CASE WHEN source = 'offstreet' THEN 250 ELSE 0 END");
            }
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
            $query->addSelect(['municipality_id', 'country_id']);
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
