<?php

namespace App\Traits;

use App\Support\GeoBounds;
use App\Support\GeoPoint;
use Illuminate\Database\Eloquent\Builder;
use InvalidArgumentException;

trait HasParkingLocation
{
    public function initializeHasParkingLocation(): void
    {
        $this->mergeHidden(['location']);
    }

    private function locationColumn(Builder $query): string
    {
        return $query->getQuery()->getGrammar()->wrap($query->getModel()->qualifyColumn('location'));
    }

    public function scopeWithinRadius(Builder $query, GeoPoint $origin, float $metres): Builder
    {
        if (! is_finite($metres) || $metres < 0) {
            throw new InvalidArgumentException('Radius must be a finite non-negative number of metres.');
        }

        return $query->whereRaw(
            'ST_DWithin('.$this->locationColumn($query).', ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)',
            [...$origin->bindings(), $metres],
        );
    }

    public function scopeWithDistanceFrom(Builder $query, GeoPoint $origin): Builder
    {
        if ($query->getQuery()->columns === null) {
            $query->select($query->getModel()->qualifyColumn('*'));
        }

        return $query->selectRaw(
            'ST_Distance('.$this->locationColumn($query).', ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography) AS distance_metres',
            $origin->bindings(),
        );
    }

    public function scopeNearestTo(Builder $query, GeoPoint $origin): Builder
    {
        return $query->withDistanceFrom($origin)->reorder()->orderBy('distance_metres')->orderBy($query->getModel()->getQualifiedKeyName());
    }

    public function scopeInViewport(Builder $query, GeoBounds $bounds): Builder
    {
        $location = $this->locationColumn($query);

        return $query->where(function (Builder $query) use ($bounds, $location) {
            foreach ($bounds->envelopes() as $envelope) {
                $query->orWhereRaw("{$location}::geometry && ST_MakeEnvelope(?, ?, ?, ?, 4326)", $envelope);
            }
        });
    }
}
