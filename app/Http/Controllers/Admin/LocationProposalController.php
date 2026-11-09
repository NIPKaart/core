<?php

namespace App\Http\Controllers\Admin;

use App\Enums\LocationProposalDecisionReason as Reason;
use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\PublishLocationProposalRequest;
use App\Http\Requests\RejectLocationProposalRequest;
use App\Http\Requests\StoreStandaloneParkingSpaceRequest;
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
use Illuminate\Database\Eloquent\Builder;
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
    private const int BAY_RADIUS_METRES = 150;

    private const int NEARBY_PLACES_LIMIT = 30;

    /** How many proposals one bulk action handles: the size of a page in the municipality list. */
    private const int BULK_LIMIT = 50;

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
            'view' => ['nullable', 'in:open,closed'],
        ]);
        $view = $filters['view'] ?? 'open';
        $preference = 'proposal_municipality_'.$request->user()->id;
        $municipality = isset($filters['municipality']) ? (int) $filters['municipality'] : null;

        if ($municipality !== null && ! isset($filters['proposal']) && ! isset($filters['after'])) {
            Cookie::queue($preference, (string) $municipality, 60 * 24 * 365);
        }

        if ($municipality === null && ! isset($filters['proposal']) && ! $request->boolean('overview')) {
            $remembered = (int) $request->cookie($preference);
            if ($remembered > 0 && Municipality::whereKey($remembered)->exists()) {
                return to_route('app.moderation.proposals.index', ['municipality' => $remembered]);
            }
        }

        if (isset($filters['after']) && $municipality !== null) {
            $next = $this->queue->nextInMunicipality($municipality, (int) $filters['after']);

            return to_route('app.moderation.proposals.index', [
                'municipality' => $municipality,
                ...($next === null ? [] : ['proposal' => $next]),
            ]);
        }

        $selected = isset($filters['proposal'])
            ? $this->detail((int) $filters['proposal'], isset($filters['point']) ? (int) $filters['point'] : null, $imagery)
            : null;
        $municipality = $selected['municipalityId'] ?? $municipality;
        $closedView = $view === 'closed' && $selected === null;
        $page = match (true) {
            $municipality === null => null,
            $closedView => $this->queue->closedDuplicates($municipality)->paginate(50)->withQueryString(),
            default => $this->queue->municipalityProposals($municipality)->paginate(50)->withQueryString(),
        };
        $rows = $page === null ? null : ($closedView ? $this->queue->closedRows($page->getCollection()) : $this->queue->rows($page->getCollection(), withCandidates: $selected === null));

        return Inertia::render('backend/moderation/proposals', [
            'proposals' => $page?->setCollection($rows),
            'municipalities' => $municipality === null ? $this->queue->municipalityTotals() : [],
            'municipality' => $municipality,
            'municipalityName' => $municipality === null ? null : ($selected['municipality'] ?? Municipality::whereKey($municipality)->value('name')),
            'hasNext' => $municipality !== null && ($selected === null
                ? $page->total() > 0
                : $this->queue->nextInMunicipality($municipality, $selected['id']) !== null),
            'view' => $closedView ? 'closed' : 'open',
            'onMapCount' => $municipality === null || $closedView ? 0 : $this->queue->onMapCount($municipality),
            'failedMatches' => array_map('intval', (array) $request->session()->get('proposal_matches_failed', [])),
            'recentlyClosed' => array_map('intval', (array) $request->session()->get('proposal_duplicates_closed', [])),
            'imagery' => $municipality === null || $selected !== null ? [] : $imagery->forCountry(Municipality::with('country')->find($municipality)?->country?->code),
            'fromQueue' => ($filters['from'] ?? null) === 'queue',
            'selected' => $selected,
            'bayOptions' => [
                'orientations' => ParkingOrientation::mapped(),
                'restrictionDays' => ParkingSpace::RESTRICTION_DAYS,
                'maxBays' => PublishLocationProposalRequest::MAX_BAYS,
                'rejectionReasons' => $this->reasonOptions(Reason::rejection()),
            ],
        ]);
    }

    public function publish(PublishLocationProposalRequest $request, int $proposal, ParkingLocationResolver $resolver): RedirectResponse
    {
        $record = DB::table('location_proposals')->find($proposal);
        abort_if($record === null, 404);
        $return = ['proposal' => $proposal, ...$request->only(['municipality', 'page', 'point', 'from'])];

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

            $this->decisions->record($locked, $point, $moderator, $publishedAt, null, null, $created, $total);
        });

        return to_route('app.moderation.proposals.index', $return);
    }

    public function storeStandaloneSpace(StoreStandaloneParkingSpaceRequest $request, int $proposal, ParkingLocationResolver $resolver): RedirectResponse
    {
        abort_unless(DB::table('location_proposals')->where('id', $proposal)->exists(), 404);
        $point = new GeoPoint(round((float) $request->validated('latitude'), 7), round((float) $request->validated('longitude'), 7));
        $location = $resolver->lookup($point->latitude, $point->longitude)
            ?? throw ValidationException::withMessages(['latitude' => __('parking_spaces.contribute.unresolved')]);
        $moderator = $request->user();
        $evidence = sprintf('Street View: https://maps.google.com/maps?q=&layer=c&cbll=%.7F,%.7F', $point->latitude, $point->longitude);

        DB::transaction(function () use ($request, $resolver, $point, $location, $moderator, $evidence): void {
            $space = ParkingSpace::withTrashed()->firstOrCreate(
                ['id' => $request->validated('submission_id')],
                [
                    'latitude' => $point->latitude,
                    'longitude' => $point->longitude,
                    ...$resolver->attributesFor($location),
                    ...$request->parkingSpaceDetails(),
                    'status' => ParkingStatus::APPROVED,
                ],
            );

            if (! $space->wasRecentlyCreated) {
                if ($space->trashed() || $space->location_proposal_id !== null || ! $space->confirmations()
                    ->where('user_id', $moderator->id)->where('comment', $evidence)->exists()) {
                    throw ValidationException::withMessages(['submission_id' => __('parking_spaces.proposal.changed')]);
                }

                return;
            }

            $now = now();
            $space->reviews()->create([
                'reviewed_by' => $moderator->id,
                'from_status' => null,
                'to_status' => ParkingStatus::APPROVED,
                'reviewed_at' => $now,
            ]);
            $space->confirmations()->create([
                'user_id' => $moderator->id,
                'status' => ParkingConfirmationStatus::CONFIRMED,
                'confirmed_at' => $now,
                'comment' => $evidence,
            ]);
        });

        Inertia::flash('success', __('parking_spaces.proposal.standalone_added'));

        return to_route('app.moderation.proposals.index', ['proposal' => $proposal, ...$request->only(['municipality', 'page', 'point', 'from'])]);
    }

    public function reject(RejectLocationProposalRequest $request, int $proposal): RedirectResponse
    {
        DB::transaction(function () use ($request, $proposal): void {
            $this->lockSources([$proposal]);
            $record = DB::table('location_proposals')->lockForUpdate()->find($proposal);
            abort_if($record === null, 404);
            $this->decisions->checkRevision($record, (int) $request->validated('revision'));
            if ($record->closed_at !== null || $record->bays_published_at !== null) {
                throw ValidationException::withMessages(['decision' => __('parking_spaces.proposal.changed')]);
            }

            $points = $this->proposalPoints($proposal);
            $point = $request->filled('point') ? $points->firstWhere('id', $request->integer('point')) : $points->first();
            if ($point === null && $request->filled('point')) {
                throw ValidationException::withMessages(['decision' => __('parking_spaces.proposal.changed')]);
            }
            abort_if($point === null, 404);

            $reason = Reason::from($request->validated('reason'));
            $existing = null;
            if ($reason === Reason::DUPLICATE) {
                $municipalId = $request->validated('existing_parking_municipal_id');
                $field = $municipalId === null ? 'existing_parking_space_id' : 'existing_parking_municipal_id';
                $existing = ($municipalId === null ? $this->nearbyCommunity($point) : $this->nearbyMunicipal($point))
                    ->whereKey($request->validated($field))->lockForUpdate()->first();
                if ($existing === null) {
                    throw ValidationException::withMessages([$field => __('parking_spaces.proposal.existing_required')]);
                }
            }

            $this->decisions->record($record, $point, $request->user(), now(), $reason, $request->validated('note'), existing: $existing);
        });

        Inertia::flash('success', __('parking_spaces.proposal.rejected'));

        return $request->query('from') === 'queue' && ! $request->filled('municipality')
            ? to_route('app.moderation.index')
            : to_route('app.moderation.proposals.index', $request->only(['municipality', 'page']));
    }

    public function closeDuplicates(Request $request): RedirectResponse
    {
        $this->authorizeModeration();
        $data = $request->validate([
            'matches' => ['required', 'array', 'list', 'min:1', 'max:'.self::BULK_LIMIT],
            'matches.*' => ['required', 'array:proposal,point,revision,source,parking_id'],
            'matches.*.proposal' => ['required', 'integer', 'min:1', 'distinct'],
            'matches.*.point' => ['required', 'integer', 'min:1'],
            'matches.*.revision' => ['required', 'integer', 'min:0'],
            'matches.*.source' => ['required', 'in:community,municipal'],
            'matches.*.parking_id' => ['required', 'string', 'max:255'],
            'municipality' => ['nullable', 'integer', 'min:1'],
        ]);

        $matches = collect($data['matches'])->keyBy('proposal');
        $closed = DB::transaction(function () use ($request, $matches, $data): array {
            $ids = $matches->keys()->all();
            $this->lockSources($ids);
            $records = DB::table('location_proposals')->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
            $closed = [];
            foreach ($records as $record) {
                $match = $matches->get($record->id);
                if ($record->closed_at !== null || $record->bays_published_at !== null
                    || $record->decision_revision !== (int) $match['revision']
                    || (isset($data['municipality']) && $record->municipality_id !== (int) $data['municipality'])) {
                    continue;
                }
                $points = $this->proposalPoints($record->id);
                $point = $points->first();
                if ($points->count() !== 1 || $point->id !== (int) $match['point']) {
                    continue;
                }
                if ($match['source'] === 'community' && ! Str::isUuid($match['parking_id'])) {
                    continue;
                }
                $existing = ($match['source'] === 'municipal' ? $this->nearbyMunicipal($point) : $this->nearbyCommunity($point))
                    ->whereKey($match['parking_id'])->lockForUpdate()->first();
                if ($existing === null) {
                    continue;
                }
                $this->decisions->record($record, $point, $request->user(), now(), Reason::DUPLICATE, null, existing: $existing);
                $closed[] = $record->id;
            }

            return $closed;
        }, 3);

        $request->session()->flash('proposal_duplicates_closed', $closed);
        $request->session()->flash('proposal_matches_failed', array_values(array_diff($matches->keys()->all(), $closed)));

        return to_route('app.moderation.proposals.index', $request->only(['municipality']));
    }

    /** Undo closing as already on the map: reopen those proposals whose latest decision is still that one. */
    public function reopenDuplicates(Request $request): RedirectResponse
    {
        $this->authorizeModeration();
        $data = $request->validate([
            'proposals' => ['required', 'array', 'min:1', 'max:'.self::BULK_LIMIT],
            'proposals.*' => ['integer', 'min:1', 'distinct'],
            'municipality' => ['nullable', 'integer', 'min:1'],
        ]);

        $reopened = DB::transaction(function () use ($data): int {
            $ids = array_map('intval', $data['proposals']);
            $this->lockSources($ids);
            $records = DB::table('location_proposals')->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
            $reopened = 0;
            foreach ($records as $record) {
                $latest = LocationProposalDecision::where('location_proposal_id', $record->id)->latest('id')->first();
                if ($record->closed_at === null || $record->bays_published_at !== null || $latest?->reason !== Reason::DUPLICATE) {
                    continue;
                }
                DB::table('location_proposals')->where('id', $record->id)->update([
                    'closed_at' => null,
                    'decision_revision' => $record->decision_revision + 1,
                ]);
                $reopened++;
            }

            return $reopened;
        });

        Inertia::flash('success', trans_choice('parking_spaces.proposal.duplicates_reopened', $reopened, ['count' => $reopened]));

        return to_route('app.moderation.proposals.index', $request->only(['municipality']));
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

        return to_route('app.moderation.proposals.index', ['proposal' => $proposal, ...$request->only(['municipality', 'page', 'point', 'from'])]);
    }

    private function reasonOptions(array $reasons): array
    {
        return array_map(fn (Reason $reason): array => ['value' => $reason->value, 'label' => $reason->label()], $reasons);
    }

    private function nearbyCommunity(object $point): Builder
    {
        $location = new GeoPoint($point->latitude, $point->longitude);

        return ParkingSpace::query()->select('id', 'street', 'latitude', 'longitude')->where('status', ParkingStatus::APPROVED)->withinRadius($location, LocationProposalQueue::NEARBY_COMMUNITY_METRES)->nearestTo($location);
    }

    private function nearbyMunicipal(object $point): Builder
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

        return [
            'id' => $id,
            'pointId' => $anchor->id,
            'municipality' => $anchor->municipality,
            'municipalityId' => $anchor->municipality_id,
            'points' => $points->map(fn (object $point): array => $this->queue->pointData($point)),
            'published' => $closed,
            'revision' => $record->decision_revision,
            'canReject' => $record->bays_published_at === null,
            'canAddStandalone' => Gate::allows('create', ParkingSpace::class),
            'publishedBays' => $publishedBays,
            'community' => $community->map($nearbyPlace)->all(),
            'municipal' => $municipal->map($nearbyPlace)->all(),
            'decision' => $closed && $record->bays_published_at === null ? $this->closedDecision($id) : null,
            'imagery' => $imagery->forCountry($anchor->country),
        ];
    }

    /**
     * Why a proposal was closed without bays, and the parking space it duplicates, for the panel of a closed proposal.
     *
     * @return array{reason: ?string, reasonLabel: ?string, decidedAt: string, moderator: ?string, existing: ?array<string, mixed>}|null
     */
    private function closedDecision(int $proposal): ?array
    {
        $decision = LocationProposalDecision::with('moderator:id,name')->where('location_proposal_id', $proposal)->latest('id')->first();
        if ($decision === null) {
            return null;
        }
        $existing = match (true) {
            $decision->existing_parking_municipal_id !== null => ['municipal', ParkingMunicipal::where('visibility', true)->find($decision->existing_parking_municipal_id, ['id', 'latitude', 'longitude'])],
            $decision->existing_parking_space_id !== null => ['community', ParkingSpace::where('status', ParkingStatus::APPROVED)->find($decision->existing_parking_space_id, ['id', 'latitude', 'longitude'])],
            default => [null, null],
        };

        return [
            'reason' => $decision->reason?->value,
            'reasonLabel' => $decision->reason?->label(),
            'decidedAt' => $decision->decided_at->toIso8601String(),
            'moderator' => $decision->moderator?->name,
            'existing' => $existing[0] === null ? null : [
                'source' => $existing[0],
                'street' => $decision->evidence['street'] ?? null,
                'distance_metres' => isset($decision->evidence['marker_distance_metres']) ? round((float) $decision->evidence['marker_distance_metres'], 1) : null,
                'url' => $existing[1] === null ? null : route('location-map', [
                    'place' => "{$existing[0]}:{$existing[1]->id}", 'at' => "{$existing[1]->latitude},{$existing[1]->longitude}",
                ]),
            ],
        ];
    }

    private function proposalPoints(int $id): Collection
    {
        return $this->queue->activePoints()->where('point.location_proposal_id', $id)->orderBy('point.id')
            ->join('municipalities as municipality', 'municipality.id', '=', 'point.municipality_id')
            ->select('point.*', 'source.name as source', 'municipality.name as municipality')
            ->selectRaw("source.description->'area'->>'country' AS country")->get();
    }

    private function authorizeModeration(): void
    {
        Gate::authorize('viewAny', ParkingSpace::class);
        Gate::authorize('bulkUpdate', ParkingSpace::class);
    }
}
