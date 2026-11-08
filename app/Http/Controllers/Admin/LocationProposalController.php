<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Models\DatasetSource;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingSpace;
use App\Services\AerialImagery;
use App\Services\ModerationEvidence;
use App\Support\GeoPoint;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LocationProposalController extends Controller
{
    private const int GROUP_RADIUS_METRES = 150;

    public function index(Request $request, AerialImagery $imagery, ModerationEvidence $evidence): Response
    {
        $this->authorizeModeration();
        $filters = $request->validate([
            'municipality' => ['nullable', 'integer', 'min:1'],
            'proposal' => ['nullable', 'integer', 'min:1'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $municipality = $filters['municipality'] ?? null;
        $selected = isset($filters['proposal']) ? $this->detail((int) $filters['proposal'], $evidence, $imagery) : null;
        $page = DB::table('location_proposals as proposal')
            ->join('municipalities as municipality', 'municipality.id', '=', 'proposal.municipality_id')
            ->whereExists($this->activePoints()->whereColumn('point.location_proposal_id', 'proposal.id'))
            ->when($municipality !== null, fn (Builder $query) => $query->where('proposal.municipality_id', $municipality))
            ->orderBy('proposal.id')->paginate(50, ['proposal.id', 'municipality.name as municipality'])->withQueryString();
        $points = $this->activePoints()->whereIn('point.location_proposal_id', $page->getCollection()->pluck('id'))
            ->orderBy('point.id')->get(['point.*', 'source.name as source'])->groupBy('location_proposal_id');

        return Inertia::render('backend/moderation/proposals', [
            'proposals' => $page->through(fn (object $proposal): array => [
                'id' => $proposal->id,
                'municipality' => $proposal->municipality,
                'points' => $points->get($proposal->id, collect())->map(fn (object $point): array => $this->pointData($point))->values(),
                'status' => 'open',
                'bayCount' => null,
            ]),
            'municipalities' => Municipality::query()
                ->whereIn('id', $this->activePoints()->select('point.municipality_id')->distinct())
                ->orderBy('name')->get(['id', 'name']),
            'municipality' => $municipality,
            'selected' => $selected,
        ]);
    }

    public function group(Request $request, int $proposal): RedirectResponse
    {
        $this->authorizeModeration();
        $data = $request->validate(['with' => ['required', 'integer', 'min:1', 'not_in:'.$proposal]]);
        $other = (int) $data['with'];

        DB::transaction(function () use ($proposal, $other): void {
            $sources = DB::table('location_proposal_points')->whereIn('location_proposal_id', [$proposal, $other])
                ->select('dataset_source_id')->distinct();
            DatasetSource::whereIn('id', $sources)->orderBy('id')->lockForUpdate()->get(['id']);
            // The source lock serializes grouping with snapshot reconciliation.
            $points = $this->proposalPoints($proposal);
            $anchor = $points->first();
            abort_if($anchor === null, 404);
            if (! $this->groupCandidates($anchor)->where('point.location_proposal_id', $other)->exists()) {
                throw ValidationException::withMessages(['with' => __('The other proposal is no longer available for grouping.')]);
            }

            DB::table('location_proposal_points')->where('location_proposal_id', $other)
                ->where('municipality_id', $anchor->municipality_id)
                ->update(['location_proposal_id' => $proposal]);
        });

        return to_route('app.moderation.proposals.index', ['proposal' => $proposal, 'municipality' => $request->query('municipality')]);
    }

    private function detail(int $id, ModerationEvidence $evidence, AerialImagery $imagery): array
    {
        $points = $this->proposalPoints($id);
        $anchor = $points->first();
        abort_if($anchor === null, 404);
        $location = new GeoPoint($anchor->latitude, $anchor->longitude);
        $community = ParkingSpace::select('id', 'street', 'latitude', 'longitude')
            ->where('status', ParkingStatus::APPROVED)->withinRadius($location, 250)->nearestTo($location)->first();
        $municipal = $evidence->nearestMunicipal($location);
        $municipalPosition = $municipal === null ? null : ParkingMunicipal::find($municipal['id'], ['latitude', 'longitude']);
        $candidates = $this->groupCandidates($anchor)
            ->orderBy('point.id')->limit(20)->get(['point.*', 'source.name as source'])
            ->unique('location_proposal_id')->map(fn (object $point): array => $this->pointData($point))->values();

        return [
            'id' => $id,
            'points' => $points->map(fn (object $point): array => $this->pointData($point)),
            'candidates' => $candidates,
            'community' => $community === null ? null : [
                'street' => $community->street,
                'latitude' => $community->latitude,
                'longitude' => $community->longitude,
                'distance_metres' => (int) round((float) $community->distance_metres),
            ],
            'municipal' => $municipalPosition === null ? null : [
                ...$municipal, 'latitude' => $municipalPosition->latitude, 'longitude' => $municipalPosition->longitude,
            ],
            'imagery' => $imagery->forCountry($anchor->country),
        ];
    }

    private function proposalPoints(int $id): Collection
    {
        return $this->activePoints()->where('point.location_proposal_id', $id)->orderBy('point.id')
            ->select('point.*', 'source.name as source')
            ->selectRaw("source.description->'area'->>'country' AS country")->get();
    }

    private function groupCandidates(object $anchor): Builder
    {
        return $this->activePoints()->where('point.municipality_id', $anchor->municipality_id)
            ->where('point.location_proposal_id', '<>', $anchor->location_proposal_id)
            ->where('point.dataset_source_id', $anchor->dataset_source_id)
            ->whereRaw('ST_DWithin(ST_SetSRID(ST_MakePoint(point.longitude, point.latitude), 4326)::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)',
                [$anchor->longitude, $anchor->latitude, self::GROUP_RADIUS_METRES]);
    }

    private function activePoints(): Builder
    {
        return DB::table('location_proposal_points as point')
            ->join('dataset_sources as source', 'source.id', '=', 'point.dataset_source_id')
            ->where('source.approval_state', 'approved')
            ->whereNotNull('point.location_proposal_id')->whereNotNull('point.municipality_id')
            ->whereNull('point.missing_since')->where('point.personal', false);
    }

    private function pointData(object $point): array
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

    private function authorizeModeration(): void
    {
        Gate::authorize('viewAny', ParkingSpace::class);
        Gate::authorize('bulkUpdate', ParkingSpace::class);
    }
}
