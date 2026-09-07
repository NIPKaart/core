<?php

namespace App\Services;

use App\Enums\ParkingStatus;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use App\Support\GeoBounds;
use App\Support\GeoPoint;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class ParkingDiscovery
{
    public function withinRadius(GeoPoint $origin, float $metres, int $limit = 100): Collection
    {
        return $this->query(fn (Builder $query) => $query->withinRadius($origin, $metres)->withDistanceFrom($origin), $limit, true);
    }

    public function inViewport(GeoBounds $bounds, int $limit = 100): Collection
    {
        return $this->query(fn (Builder $query) => $query->inViewport($bounds), $limit, false);
    }

    private function query(callable $filter, int $limit, bool $withDistance): Collection
    {
        if ($limit < 1 || $limit > 1000) {
            throw new InvalidArgumentException('Result limit must be between 1 and 1000.');
        }

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

        $query = DB::query()->fromSub($union, 'parking_options');
        if ($withDistance) {
            $query->orderBy('distance_metres');
        }

        return $query->orderBy('source')->orderBy('id')->limit($limit)->get();
    }
}
