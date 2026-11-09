<?php

namespace App\Services;

use App\Enums\LocationProposalDecisionReason;
use App\Enums\ParkingStatus;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class LocationProposalQueue
{
    public const int OVERLAP_RADIUS_METRES = 3;

    private const string POINT_GEOGRAPHY = 'ST_SetSRID(ST_MakePoint(point.longitude, point.latitude), 4326)::geography';

    public function proposals(): Builder
    {
        return DB::table('location_proposals as proposal')
            ->join('municipalities as municipality', 'municipality.id', '=', 'proposal.municipality_id')
            ->whereNull('proposal.closed_at')
            ->whereExists($this->activePoints()->whereColumn('point.location_proposal_id', 'proposal.id'))
            ->select('proposal.id', 'proposal.reported_bays', 'municipality.name as municipality')
            ->orderBy('proposal.id');
    }

    /** The open proposals of one municipality, those with parking already on the map within 3 m first. */
    public function municipalityProposals(int $municipality): Builder
    {
        $onMap = $this->onMapPoints();

        return $this->proposals()->where('proposal.municipality_id', $municipality)
            ->selectRaw('EXISTS ('.$onMap->toSql().') AS on_map', $onMap->getBindings())
            ->reorder()->orderByDesc('on_map')->orderBy('proposal.id');
    }

    public function onMapCount(int $municipality): int
    {
        return $this->proposals()->where('proposal.municipality_id', $municipality)->whereExists($this->onMapPoints())->count();
    }

    /**
     * Proposals closed as already on the map, newest first, with the parking space they were matched to.
     */
    public function closedDuplicates(int $municipality): Builder
    {
        return DB::table('location_proposals as proposal')
            ->join('municipalities as municipality', 'municipality.id', '=', 'proposal.municipality_id')
            ->join('location_proposal_decisions as decision', 'decision.id', '=', DB::raw(
                '(SELECT max(latest.id) FROM location_proposal_decisions AS latest WHERE latest.location_proposal_id = proposal.id)'
            ))
            ->leftJoin('users as moderator', 'moderator.id', '=', 'decision.moderator_id')
            ->where('proposal.municipality_id', $municipality)
            ->whereNotNull('proposal.closed_at')->whereNull('proposal.bays_published_at')
            ->where('decision.reason', LocationProposalDecisionReason::DUPLICATE->value)
            ->whereExists($this->activePoints()->whereColumn('point.location_proposal_id', 'proposal.id'))
            ->select('proposal.id', 'proposal.reported_bays', 'proposal.decision_revision', 'municipality.name as municipality')
            ->addSelect('decision.decided_at', 'decision.evidence', 'moderator.name as moderator')
            ->orderByDesc('decision.decided_at')->orderByDesc('proposal.id');
    }

    private function onMapPoints(): Builder
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
        $columns = "nearby.id::text, nearby.street, nearby.latitude, nearby.longitude, {$distance} AS distance";
        $municipal = $this->municipalOverlap()->selectRaw("'municipal' AS kind, {$columns}");
        $community = $this->communityOverlap()->selectRaw("'community' AS kind, {$columns}");

        return DB::query()->fromSub($municipal->unionAll($community), 'matches')
            ->selectRaw("json_build_object('source', kind, 'id', id, 'street', street, 'latitude', latitude, 'longitude', longitude, 'distance_metres', round(distance::numeric, 1))")
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

    public function nextInMunicipality(int $municipality, int $after): ?int
    {
        $open = $this->proposals()->select('proposal.id')->where('proposal.municipality_id', $municipality);

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
    public function rows(Collection $proposals): Collection
    {
        $points = $this->activePoints()->whereIn('point.location_proposal_id', $proposals->pluck('id'))
            ->select('point.*', 'source.name as source')->selectSub($this->closestOverlap(), 'overlap')
            ->orderBy('point.id')->get()->groupBy('location_proposal_id');

        return $proposals->map(fn (object $proposal): array => [
            'id' => $proposal->id,
            'municipality' => $proposal->municipality,
            'points' => $points->get($proposal->id, collect())->map($this->pointData(...))->values(),
            'status' => 'open',
            'bayCount' => $proposal->reported_bays,
        ]);
    }

    /**
     * Closed duplicates as rows: the proposal's points and the parking space it was matched to.
     *
     * @param  Collection<int, object>  $proposals
     */
    public function closedRows(Collection $proposals): Collection
    {
        $points = $this->activePoints()->whereIn('point.location_proposal_id', $proposals->pluck('id'))
            ->select('point.*', 'source.name as source')->orderBy('point.id')->get()->groupBy('location_proposal_id');

        return $proposals->map(function (object $proposal) use ($points): array {
            $evidence = json_decode($proposal->evidence, true, flags: JSON_THROW_ON_ERROR);

            return [
                'id' => $proposal->id,
                'municipality' => $proposal->municipality,
                'points' => $points->get($proposal->id, collect())->map($this->pointData(...))->values(),
                'status' => 'added',
                'bayCount' => $proposal->reported_bays,
                'decidedAt' => $proposal->decided_at,
                'moderator' => $proposal->moderator,
                'existing' => ($evidence['existing_source'] ?? null) === null ? null : [
                    'source' => $evidence['existing_source'],
                    'street' => $evidence['street'] ?? null,
                    'distance_metres' => isset($evidence['marker_distance_metres']) ? round((float) $evidence['marker_distance_metres'], 1) : null,
                ],
            ];
        });
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
