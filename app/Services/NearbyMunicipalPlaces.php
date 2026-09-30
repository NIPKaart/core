<?php

namespace App\Services;

use App\Enums\ParkingStatus;
use App\Models\ParkingMunicipal;
use App\Models\ParkingSpace;
use App\Support\GeoPoint;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Visible municipal places near a community submission, shown to moderators while they review it.
 *
 * The municipality's dataset is the source of truth for its places. Whether a submission describes one of them is the
 * moderator's decision: this only points out what lies nearby and never rejects, links or merges records.
 */
class NearbyMunicipalPlaces
{
    /**
     * A pending submission this close to a visible municipal place is flagged for the moderator.
     * Matches NEARBY_METRES in the contributor's add flow (use-pin-location.ts), so both warn about the same places.
     */
    public const int THRESHOLD_METRES = 30;

    /**
     * Municipal places within this distance are shown on the moderator's map.
     */
    private const int MAP_RADIUS_METRES = 100;

    /**
     * Add `nearby_municipal_metres` to community spaces: the rounded distance to the nearest visible municipal place
     * within THRESHOLD_METRES of a pending submission, or null.
     *
     * @param  Builder<ParkingSpace>  $query
     * @return Builder<ParkingSpace>
     */
    public function withNearbyDistance(Builder $query): Builder
    {
        if ($query->getQuery()->columns === null) {
            $query->select($query->getModel()->qualifyColumn('*'));
        }

        $grammar = $query->getQuery()->getGrammar();
        $space = $grammar->wrap($query->getModel()->qualifyColumn('location'));
        $status = $grammar->wrap($query->getModel()->qualifyColumn('status'));
        $municipal = $grammar->wrap((new ParkingMunicipal)->qualifyColumn('location'));

        return $query->selectSub(
            ParkingMunicipal::query()
                ->selectRaw("round(min(ST_Distance({$municipal}, {$space})))::integer")
                ->where('visibility', true)
                ->whereRaw("ST_DWithin({$municipal}, {$space}, ?)", [self::THRESHOLD_METRES])
                ->whereRaw("{$status} = ?", [ParkingStatus::PENDING->value]),
            'nearby_municipal_metres',
        );
    }

    /**
     * The nearest visible municipal places around a location, for the moderator's map.
     *
     * @return Collection<int, ParkingMunicipal>
     */
    public function around(GeoPoint $location, int $limit = 10): Collection
    {
        return ParkingMunicipal::select('id', 'latitude', 'longitude')
            ->where('visibility', true)
            ->withinRadius($location, self::MAP_RADIUS_METRES)
            ->nearestTo($location)
            ->limit($limit)
            ->get();
    }
}
