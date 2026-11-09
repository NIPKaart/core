<?php

namespace App\Services;

use App\Enums\ParkingStatus;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class LocationProposalQueue
{
    public const int OVERLAP_RADIUS_METRES = 3;

    private const string POINT_GEOGRAPHY = 'ST_SetSRID(ST_MakePoint(point.longitude, point.latitude), 4326)::geography';

    public function proposals(?string $overlap = null): Builder
    {
        $query = DB::table('location_proposals as proposal')
            ->join('municipalities as municipality', 'municipality.id', '=', 'proposal.municipality_id')
            ->whereNull('proposal.closed_at')
            ->whereExists($this->activePoints()->whereColumn('point.location_proposal_id', 'proposal.id'))
            ->select('proposal.id', 'proposal.reported_bays', 'municipality.name as municipality')
            ->orderBy('proposal.id');

        if ($overlap !== null) {
            $query->whereExists($this->matchedPoints(), not: $overlap !== 'possible');
        }

        return $query;
    }

    private function matchedPoints(): Builder
    {
        return $this->activePoints()->whereColumn('point.location_proposal_id', 'proposal.id')
            ->where(fn (Builder $points) => $points->whereExists($this->municipalOverlap())->orWhereExists($this->communityOverlap()));
    }

    private function municipalOverlap(): Builder
    {
        return DB::table('parking_municipal_spaces as nearby')->where('nearby.visibility', true)
            ->whereRaw('ST_DWithin(nearby.location, '.self::POINT_GEOGRAPHY.', ?)', [self::OVERLAP_RADIUS_METRES]);
    }

    private function communityOverlap(): Builder
    {
        return DB::table('parking_spaces as nearby')->where('nearby.status', ParkingStatus::APPROVED->value)->whereNull('nearby.deleted_at')
            ->whereRaw('ST_DWithin(nearby.location, '.self::POINT_GEOGRAPHY.', ?)', [self::OVERLAP_RADIUS_METRES]);
    }

    private function closestOverlap(): Builder
    {
        $distance = 'ST_Distance(nearby.location, '.self::POINT_GEOGRAPHY.')';
        $municipal = $this->municipalOverlap()->selectRaw("'municipal' AS kind, nearby.id::text, nearby.street, {$distance} AS distance");
        $community = $this->communityOverlap()->selectRaw("'community' AS kind, nearby.id::text, nearby.street, {$distance} AS distance");

        return DB::query()->fromSub($municipal->unionAll($community), 'matches')
            ->selectRaw("json_build_object('source', kind, 'street', street, 'distance_metres', round(distance::numeric, 1))")
            ->orderBy('distance')->orderBy('kind')->orderBy('id')->limit(1);
    }

    public function municipalityTotals(): Collection
    {
        $totals = $this->proposals()->reorder()
            ->select('municipality.id', 'municipality.name')->selectRaw('count(*) as open_count, min(proposal.id) as first_proposal')
            ->groupBy('municipality.id', 'municipality.name')->orderBy('municipality.name')->orderBy('municipality.id')->get();
        $points = $this->activePoints()->whereIn('point.location_proposal_id', $totals->pluck('first_proposal'))
            ->selectRaw('DISTINCT ON (point.location_proposal_id) point.location_proposal_id, point.latitude, point.longitude')
            ->orderBy('point.location_proposal_id')->orderBy('point.id')->get()->keyBy('location_proposal_id');

        return $totals->map(fn (object $total): array => [
            'id' => $total->id,
            'name' => $total->name,
            'open_count' => $total->open_count,
            'point' => isset($points[$total->first_proposal]) ? [
                'latitude' => $points[$total->first_proposal]->latitude,
                'longitude' => $points[$total->first_proposal]->longitude,
            ] : null,
        ]);
    }

    public function nextInMunicipality(int $municipality, int $after, ?string $overlap = null): ?int
    {
        $open = $this->proposals($overlap)->select('proposal.id')->where('proposal.municipality_id', $municipality);

        return (clone $open)->where('proposal.id', '>', $after)->value('proposal.id')
            ?? $open->where('proposal.id', '<', $after)->value('proposal.id');
    }

    public function activePoints(): Builder
    {
        return DB::table('location_proposal_points as point')
            ->join('dataset_sources as source', 'source.id', '=', 'point.dataset_source_id')
            ->where('source.approval_state', 'approved')
            ->whereNotNull('point.location_proposal_id')->whereNotNull('point.municipality_id')
            ->whereNull('point.missing_since')->where('point.personal', false);
    }

    /** @param  Collection<int, object>  $proposals */
    public function rows(Collection $proposals, ?string $overlap = null): Collection
    {
        $query = $this->activePoints()->whereIn('point.location_proposal_id', $proposals->pluck('id'))
            ->select('point.*', 'source.name as source')->orderBy('point.id');
        if ($overlap === 'possible') {
            $query->selectSub($this->closestOverlap(), 'overlap');
        }
        $points = $query->get()->groupBy('location_proposal_id');

        return $proposals->map(fn (object $proposal): array => [
            'id' => $proposal->id,
            'municipality' => $proposal->municipality,
            'points' => $points->get($proposal->id, collect())->map($this->pointData(...))->values(),
            'status' => 'open',
            'bayCount' => $proposal->reported_bays,
        ]);
    }

    public function pointData(object $point): array
    {
        return [
            'id' => $point->id,
            'proposal_id' => $point->location_proposal_id,
            'external_id' => $point->external_id,
            'latitude' => $point->latitude,
            'longitude' => $point->longitude,
            'source' => $point->source,
            'source_last_seen_on' => $point->source_last_seen_on,
            ...isset($point->overlap) ? ['overlap' => json_decode($point->overlap, true, flags: JSON_THROW_ON_ERROR)] : [],
            'under_sign_types' => json_decode($point->under_sign_types, true, flags: JSON_THROW_ON_ERROR),
        ];
    }
}
