<?php

namespace App\Services;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class LocationProposalQueue
{
    public function proposals(): Builder
    {
        return DB::table('location_proposals as proposal')
            ->join('municipalities as municipality', 'municipality.id', '=', 'proposal.municipality_id')
            ->whereNull('proposal.closed_at')
            ->whereExists($this->activePoints()->whereColumn('point.location_proposal_id', 'proposal.id'))
            ->select('proposal.id', 'proposal.reported_bays', 'municipality.name as municipality')
            ->orderBy('proposal.id');
    }

    public function municipalityTotals(): Collection
    {
        return $this->proposals()->reorder()
            ->select('municipality.id', 'municipality.name')->selectRaw('count(*) as open_count')
            ->groupBy('municipality.id', 'municipality.name')->orderBy('municipality.name')->orderBy('municipality.id')->get();
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
            ->orderBy('point.id')->get(['point.*', 'source.name as source'])->groupBy('location_proposal_id');

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
            'under_sign_types' => json_decode($point->under_sign_types, true, flags: JSON_THROW_ON_ERROR),
        ];
    }
}
