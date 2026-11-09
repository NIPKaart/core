<?php

namespace App\Http\Controllers\Admin;

use App\Enums\LocationProposalDecisionReason as Reason;
use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\PublishLocationProposalRequest;
use App\Http\Requests\RejectLocationProposalRequest;
use App\Models\DatasetSource;
use App\Models\LocationProposalDecision;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingSpace;
use App\Services\AerialImagery;
use App\Services\LocationProposalDecisions;
use App\Services\LocationProposalQueue;
use App\Services\ModerationEvidence;
use App\Services\ParkingLocationResolver;
use App\Support\GeoPoint;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LocationProposalController extends Controller
{
    private const int GROUP_RADIUS_METRES = 150;

    private const int BAY_RADIUS_METRES = 150;

    private const int NEARBY_PLACES_LIMIT = 30;

    public function __construct(private LocationProposalQueue $queue, private LocationProposalDecisions $decisions) {}

    public function index(Request $request, AerialImagery $imagery): Response|RedirectResponse
    {
        $this->authorizeModeration();
        $filters = $request->validate([
            'municipality' => ['nullable', 'integer', 'min:1', 'exists:municipalities,id'],
            'overview' => ['nullable', 'boolean'],
            'after' => ['nullable', 'integer', 'min:0', 'prohibits:proposal,point'],
            'proposal' => ['nullable', 'integer', 'min:1'],
            'point' => ['nullable', 'integer', 'min:1'],
            'from' => ['nullable', 'in:queue'],
            'page' => ['nullable', 'integer', 'min:1'],
            'overlap' => ['nullable', 'in:possible,none'],
        ]);
        $overlapFilter = $filters['overlap'] ?? null;
        $preference = 'proposal_municipality_'.$request->user()->id;
        $municipality = isset($filters['municipality']) ? (int) $filters['municipality'] : null;

        if ($municipality !== null && ! isset($filters['proposal']) && ! isset($filters['after'])) {
            Cookie::queue($preference, (string) $municipality, 60 * 24 * 365);
        }

        if ($municipality === null && ! isset($filters['proposal']) && ! $request->boolean('overview')) {
            $remembered = (int) $request->cookie($preference);
            if ($remembered > 0 && Municipality::whereKey($remembered)->exists()) {
                return to_route('app.moderation.proposals.index', ['municipality' => $remembered, 'overlap' => $overlapFilter]);
            }
        }

        if (isset($filters['after']) && $municipality !== null) {
            $next = $this->queue->nextInMunicipality($municipality, (int) $filters['after'], $overlapFilter);

            return to_route('app.moderation.proposals.index', [
                'municipality' => $municipality,
                'overlap' => $overlapFilter,
                ...($next === null ? [] : ['proposal' => $next]),
            ]);
        }

        $selected = isset($filters['proposal'])
            ? $this->detail((int) $filters['proposal'], isset($filters['point']) ? (int) $filters['point'] : null, $imagery)
            : null;
        $municipality = $selected['municipalityId'] ?? $municipality;
        $page = $municipality === null ? null : $this->queue->proposals($overlapFilter)
            ->where('proposal.municipality_id', $municipality)->paginate(50)->withQueryString();

        return Inertia::render('backend/moderation/proposals', [
            'proposals' => $page?->setCollection($this->queue->rows($page->getCollection(), $overlapFilter)),
            'municipalities' => $municipality === null ? $this->queue->municipalityTotals() : [],
            'municipality' => $municipality,
            'municipalityName' => $municipality === null ? null : ($selected['municipality'] ?? Municipality::whereKey($municipality)->value('name')),
            'hasNext' => $municipality !== null && ($selected === null
                ? $page->total() > 0
                : $this->queue->nextInMunicipality($municipality, $selected['id'], $overlapFilter) !== null),
            'overlap' => $overlapFilter,
            'fromQueue' => ($filters['from'] ?? null) === 'queue',
            'selected' => $selected,
            'bayOptions' => [
                'orientations' => ParkingOrientation::mapped(),
                'restrictionDays' => ParkingSpace::RESTRICTION_DAYS,
                'maxBays' => PublishLocationProposalRequest::MAX_BAYS,
                'completionReasons' => $this->reasonOptions(Reason::completion()),
                'rejectionReasons' => $this->reasonOptions(Reason::rejection()),
            ],
        ]);
    }

    public function publish(PublishLocationProposalRequest $request, int $proposal, ParkingLocationResolver $resolver): RedirectResponse
    {
        $record = DB::table('location_proposals')->find($proposal);
        abort_if($record === null, 404);
        $return = ['proposal' => $proposal, ...$request->only(['municipality', 'page', 'point', 'from', 'overlap'])];

        $bays = $request->validated('bays');
        $revision = (int) $request->validated('revision', 0);
        if ($record->closed_at !== null) {
            $this->validatePublicationReplay($record, $bays, $revision);

            return to_route('app.moderation.proposals.index', $return);
        }

        $this->decisions->checkRevision($record, $revision);
        $municipality = Municipality::with('province')->findOrFail($record->municipality_id);
        $this->validateBayPoints($proposal, $bays, $municipality->id);
        $locations = [];
        foreach ($bays as $index => $bay) {
            $location = $resolver->lookup((float) $bay['latitude'], (float) $bay['longitude']);
            if ($location === null || $location['country_id'] !== $municipality->country_id) {
                throw ValidationException::withMessages(["bays.{$index}.latitude" => __('parking_spaces.contribute.unresolved')]);
            }
            $locations[] = $location;
        }

        DB::transaction(function () use ($proposal, $request, $bays, $locations, $municipality, $resolver, $revision): void {
            $this->lockSources([$proposal]);
            $locked = DB::table('location_proposals')->lockForUpdate()->find($proposal);
            abort_if($locked === null, 404);
            if ($locked->closed_at !== null) {
                $this->validatePublicationReplay($locked, $bays, $revision);

                return;
            }
            if ($locked->municipality_id !== $municipality->id) {
                throw ValidationException::withMessages(['bays' => __('parking_spaces.proposal.changed')]);
            }
            $this->decisions->checkRevision($locked, $revision);
            $this->validateBayPoints($proposal, $bays, $municipality->id);
            $point = $this->proposalPoints($proposal)->firstWhere('id', (int) $bays[0]['source_point_id']);
            $prior = ParkingSpace::withTrashed()->where('location_proposal_id', $proposal)->get();
            $total = $prior->whereNull('deleted_at')->where('status', ParkingStatus::APPROVED)->count() + count($bays);
            $number = (int) $prior->max('location_proposal_bay_number');
            $reason = Reason::tryFrom($request->validated('reason') ?? '');
            $partial = $locked->reported_bays !== null && $total < $locked->reported_bays;
            if ($partial && $reason === null) {
                throw ValidationException::withMessages(['reason' => __('parking_spaces.proposal.reason_required')]);
            }
            $publishedAt = now();
            $moderator = $request->user();
            $details = $request->parkingSpaceDetails();

            $created = [];
            foreach ($bays as $index => $bay) {
                if ($prior->whereNull('deleted_at')->contains(fn (ParkingSpace $space) => round($space->latitude, 7) === round((float) $bay['latitude'], 7)
                    && round($space->longitude, 7) === round((float) $bay['longitude'], 7))) {
                    throw ValidationException::withMessages(["bays.{$index}.latitude" => __('parking_spaces.proposal.duplicate')]);
                }
                $space = new ParkingSpace([
                    'id' => (string) Str::uuid(),
                    'latitude' => $bay['latitude'],
                    'longitude' => $bay['longitude'],
                    ...$resolver->attributesFor($locations[$index], $municipality),
                    ...$details,
                    'status' => ParkingStatus::APPROVED,
                ]);
                $space->forceFill([
                    'location_proposal_id' => $proposal,
                    'location_proposal_point_id' => $bay['source_point_id'],
                    'location_proposal_bay_number' => ++$number,
                ])->save();
                $space->reviews()->create([
                    'reviewed_by' => $moderator->id,
                    'from_status' => null,
                    'to_status' => ParkingStatus::APPROVED,
                    'reviewed_at' => $publishedAt,
                ]);
                $space->confirmations()->create([
                    'user_id' => $moderator->id,
                    'status' => ParkingConfirmationStatus::CONFIRMED,
                    'confirmed_at' => $publishedAt,
                ]);
                $created[] = $space;
            }

            $this->decisions->record($locked, $point, $moderator, $publishedAt, $partial ? $reason : null,
                $partial ? $request->validated('note') : null, $created, $total);
        });

        return to_route('app.moderation.proposals.index', $return);
    }

    public function reject(RejectLocationProposalRequest $request, int $proposal): RedirectResponse
    {
        $outcome = $request->validated('match_outcome') ?? 'same_bay';
        DB::transaction(function () use ($request, $proposal, $outcome): void {
            $this->lockSources([$proposal]);
            $record = DB::table('location_proposals')->lockForUpdate()->find($proposal);
            abort_if($record === null, 404);
            $this->decisions->checkRevision($record, (int) $request->validated('revision'));
            if ($record->closed_at !== null || $record->bays_published_at !== null) {
                throw ValidationException::withMessages(['decision' => __('parking_spaces.proposal.changed')]);
            }

            $points = $this->proposalPoints($proposal);
            $point = $points->firstWhere('id', $request->integer('point')) ?? $points->first();
            abort_if($point === null, 404);

            $reason = Reason::from($request->validated('reason'));
            $existing = null;
            if ($reason === Reason::DUPLICATE) {
                $municipalId = $request->validated('existing_parking_municipal_id');
                $field = $municipalId === null ? 'existing_parking_space_id' : 'existing_parking_municipal_id';
                $existing = ($municipalId === null ? $this->nearbyCommunity($point) : $this->nearbyMunicipal($point))
                    ->whereKey($request->validated($field))->lockForUpdate()->first();
                if ($existing === null || (float) $existing->distance_metres > LocationProposalQueue::OVERLAP_RADIUS_METRES) {
                    throw ValidationException::withMessages([$field => __('parking_spaces.proposal.existing_required')]);
                }

                DB::table('location_proposal_match_reviews')->insert([
                    'location_proposal_point_id' => $point->id,
                    'moderator_id' => $request->user()->id,
                    'parking_source' => $municipalId === null ? 'community' : 'municipal',
                    'parking_id' => $existing->id,
                    'marker_distance_metres' => round((float) $existing->distance_metres, 2),
                    'outcome' => $outcome,
                    'reviewed_at' => now(),
                ]);

                if ($outcome !== 'same_bay') {
                    return;
                }
            }

            $this->decisions->record($record, $point, $request->user(), now(), $reason, $request->validated('note'), existing: $existing);
        });

        if ($outcome !== 'same_bay') {
            Inertia::flash('success', __('parking_spaces.proposal.match_reviewed'));

            return to_route('app.moderation.proposals.index', ['proposal' => $proposal, ...$request->only(['municipality', 'page', 'point', 'from', 'overlap'])]);
        }

        Inertia::flash('success', __('parking_spaces.proposal.rejected'));

        return $request->query('from') === 'queue' && ! $request->filled('municipality')
            ? to_route('app.moderation.index')
            : to_route('app.moderation.proposals.index', $request->only(['municipality', 'page', 'overlap']));
    }

    public function reopen(Request $request, int $proposal): RedirectResponse
    {
        $this->authorizeModeration();
        $data = $request->validate(['revision' => ['required', 'integer', 'min:1']]);

        DB::transaction(function () use ($proposal, $data): void {
            $this->lockSources([$proposal]);
            $record = DB::table('location_proposals')->lockForUpdate()->find($proposal);
            abort_if($record === null || ! $this->queue->activePoints()->where('point.location_proposal_id', $proposal)->exists(), 404);
            $this->decisions->checkRevision($record, (int) $data['revision']);
            if ($record->closed_at !== null) {
                DB::table('location_proposals')->where('id', $proposal)->update([
                    'closed_at' => null,
                    'decision_revision' => $record->decision_revision + 1,
                ]);
            }
        });

        Inertia::flash('success', __('parking_spaces.proposal.reopened'));

        return to_route('app.moderation.proposals.index', ['proposal' => $proposal, ...$request->only(['municipality', 'page', 'point', 'from', 'overlap'])]);
    }

    private function reasonOptions(array $reasons): array
    {
        return array_map(fn (Reason $reason): array => ['value' => $reason->value, 'label' => $reason->label()], $reasons);
    }

    private function nearbyCommunity(object $point): \Illuminate\Database\Eloquent\Builder
    {
        $location = new GeoPoint($point->latitude, $point->longitude);

        return ParkingSpace::query()->select('id', 'street', 'latitude', 'longitude')->where('status', ParkingStatus::APPROVED)->withinRadius($location, 250)->nearestTo($location);
    }

    private function nearbyMunicipal(object $point): \Illuminate\Database\Eloquent\Builder
    {
        $location = new GeoPoint($point->latitude, $point->longitude);

        return ParkingMunicipal::select('id', 'street', 'latitude', 'longitude')
            ->where('visibility', true)
            ->withinRadius($location, ModerationEvidence::NEAREST_MUNICIPAL_METRES)
            ->nearestTo($location);
    }

    private function validatePublicationReplay(object $proposal, array $bays, int $revision): void
    {
        $decision = LocationProposalDecision::where('location_proposal_id', $proposal->id)->latest('id')->first();
        $matches = false;
        if ($proposal->decision_revision === $revision + 1 && $decision?->outcome === 'completed') {
            $previous = ParkingSpace::withTrashed()->whereKey(array_column($decision->evidence['bays'], 'id'))
                ->orderBy('location_proposal_bay_number')->get();
            $matches = count($bays) === $previous->count() && $previous->every(fn (ParkingSpace $space, int $index) => $space->location_proposal_point_id === (int) $bays[$index]['source_point_id']
                && round($space->latitude, 7) === round((float) $bays[$index]['latitude'], 7)
                && round($space->longitude, 7) === round((float) $bays[$index]['longitude'], 7));
        }

        if (! $matches) {
            throw ValidationException::withMessages(['decision' => __('parking_spaces.proposal.changed')]);
        }
    }

    private function validateBayPoints(int $proposal, array $bays, int $municipality): void
    {
        foreach ($bays as $index => $bay) {
            $valid = $this->queue->activePoints()->where('point.location_proposal_id', $proposal)
                ->where('point.municipality_id', $municipality)->where('point.id', $bay['source_point_id'])
                ->whereRaw('ST_DWithin(ST_SetSRID(ST_MakePoint(point.longitude, point.latitude), 4326)::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)',
                    [(float) $bay['longitude'], (float) $bay['latitude'], self::BAY_RADIUS_METRES])->exists();
            if (! $valid) {
                throw ValidationException::withMessages(["bays.{$index}.latitude" => __('parking_spaces.proposal.invalid_point')]);
            }
        }
    }

    /** Acquire source locks before proposal rows, as snapshot reconciliation does. */
    private function lockSources(array $proposals): void
    {
        $sources = DB::table('location_proposal_points')->whereIn('location_proposal_id', $proposals)->select('dataset_source_id')->distinct();
        DatasetSource::whereIn('id', $sources)->orderBy('id')->lockForUpdate()->get(['id']);
    }

    public function group(Request $request, int $proposal): RedirectResponse
    {
        $this->authorizeModeration();
        $data = $request->validate(['with' => ['required', 'integer', 'min:1', 'not_in:'.$proposal]]);
        $other = (int) $data['with'];

        DB::transaction(function () use ($proposal, $other): void {
            $this->lockSources([$proposal, $other]);
            if (DB::table('location_proposals')->whereIn('id', [$proposal, $other])->where(fn (Builder $query) => $query->whereNotNull('bays_published_at')->orWhere('decision_revision', '>', 0))->exists()) {
                throw ValidationException::withMessages(['with' => __('parking_spaces.proposal.already_added')]);
            }
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

        return to_route('app.moderation.proposals.index', ['proposal' => $proposal, ...$request->only(['municipality', 'page', 'point', 'from', 'overlap'])]);
    }

    private function detail(int $id, ?int $pointId, AerialImagery $imagery): array
    {
        $points = $this->proposalPoints($id);
        $anchor = $points->firstWhere('id', $pointId) ?? $points->first();
        abort_if($anchor === null, 404);
        $community = $this->nearbyCommunity($anchor)->limit(self::NEARBY_PLACES_LIMIT)->get();
        $municipal = $this->nearbyMunicipal($anchor)->limit(self::NEARBY_PLACES_LIMIT)->get();
        $nearbyPlace = static fn (ParkingSpace|ParkingMunicipal $place): array => [
            'id' => $place->id,
            'street' => $place->street,
            'latitude' => $place->latitude,
            'longitude' => $place->longitude,
            'distance_metres' => round((float) $place->distance_metres, 1),
            'possible_duplicate' => (float) $place->distance_metres <= LocationProposalQueue::OVERLAP_RADIUS_METRES,
        ];
        $record = DB::table('location_proposals')->find($id);
        $closed = $record->closed_at !== null;
        $publishedBays = $record->bays_published_at !== null ? ParkingSpace::query()->where('location_proposal_id', $id)
            ->where('status', ParkingStatus::APPROVED)->orderBy('location_proposal_bay_number')->get(['id', 'latitude', 'longitude', 'location_proposal_bay_number as number']) : [];
        $candidates = $closed || $record->decision_revision > 0 ? [] : $this->groupCandidates($anchor)
            ->orderBy('point.id')->limit(20)->get(['point.*', 'source.name as source'])
            ->unique('location_proposal_id')->map(fn (object $point): array => $this->queue->pointData($point))->values();

        return [
            'id' => $id,
            'pointId' => $anchor->id,
            'municipality' => $anchor->municipality,
            'municipalityId' => $anchor->municipality_id,
            'points' => $points->map(fn (object $point): array => $this->queue->pointData($point)),
            'candidates' => $candidates,
            'published' => $closed,
            'revision' => $record->decision_revision,
            'reportedBays' => $record->reported_bays,
            'canReject' => $record->bays_published_at === null,
            'publishedBays' => $publishedBays,
            'community' => $community->map($nearbyPlace)->all(),
            'municipal' => $municipal->map($nearbyPlace)->all(),
            'imagery' => $imagery->forCountry($anchor->country),
        ];
    }

    private function proposalPoints(int $id): Collection
    {
        return $this->queue->activePoints()->where('point.location_proposal_id', $id)->orderBy('point.id')
            ->join('municipalities as municipality', 'municipality.id', '=', 'point.municipality_id')
            ->select('point.*', 'source.name as source', 'municipality.name as municipality')
            ->selectRaw("source.description->'area'->>'country' AS country")->get();
    }

    private function groupCandidates(object $anchor): Builder
    {
        return $this->queue->activePoints()->where('point.municipality_id', $anchor->municipality_id)
            ->where('point.location_proposal_id', '<>', $anchor->location_proposal_id)
            ->whereIn('point.location_proposal_id', DB::table('location_proposals')->where('decision_revision', 0)->select('id'))
            ->where('point.dataset_source_id', $anchor->dataset_source_id)
            ->whereRaw('ST_DWithin(ST_SetSRID(ST_MakePoint(point.longitude, point.latitude), 4326)::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)',
                [$anchor->longitude, $anchor->latitude, self::GROUP_RADIUS_METRES]);
    }

    private function authorizeModeration(): void
    {
        Gate::authorize('viewAny', ParkingSpace::class);
        Gate::authorize('bulkUpdate', ParkingSpace::class);
    }
}
