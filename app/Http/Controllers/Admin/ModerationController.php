<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ImprovementRejectionReason;
use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Enums\RejectionReason;
use App\Enums\RemovalReason;
use App\Enums\UnderSign;
use App\Http\Controllers\Controller;
use App\Http\Requests\ParkingSpaceImprovementRequest;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingPlaceReport;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceImprovement;
use App\Services\ModerationHistory;
use App\Services\ModerationQueue;
use App\Services\NearbyMunicipalPlaces;
use App\Services\ParkingPlaceModeration;
use App\Services\ParkingPlaces;
use App\Services\ParkingSpaceImprovements;
use App\Support\GeoPoint;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The community moderation inbox: one queue of new submissions, proposed improvements and reported places.
 *
 * The queue and the item under review share one page, so a moderator works through the queue without losing it.
 * Every decision continues with the next item in the same order and filters. Approving always happens one item at a
 * time; several submissions and improvements may be rejected at once, for example as spam.
 */
class ModerationController extends Controller
{
    private const int PER_PAGE = 50;

    public function __construct(
        private ModerationQueue $queue,
        private ModerationHistory $history,
        private ParkingSpaceImprovements $improvements,
        private ParkingPlaceModeration $reports,
        private ParkingPlaces $places,
    ) {}

    public function index(Request $request): Response
    {
        return $this->page($request);
    }

    public function submission(Request $request, ParkingSpace $parkingSpace, NearbyMunicipalPlaces $nearbyMunicipalPlaces): Response|RedirectResponse
    {
        Gate::authorize('viewAny', ParkingSpace::class);

        if ($parkingSpace->status !== ParkingStatus::PENDING) {
            return $this->toQueue($request);
        }

        return $this->page($request, ModerationQueue::submissionKey($parkingSpace->id), fn () => [
            'space' => ['id' => $parkingSpace->id, 'street' => $parkingSpace->street, 'municipality' => $parkingSpace->municipality?->name],
            'current' => [...$this->improvements->current($parkingSpace), 'municipality' => $parkingSpace->municipality?->name],
            'nearbySpaces' => $this->nearbySpaces($parkingSpace->latitude, $parkingSpace->longitude, $parkingSpace->id),
            'nearbyMunicipalSpaces' => $nearbyMunicipalPlaces->around(new GeoPoint($parkingSpace->latitude, $parkingSpace->longitude)),
        ]);
    }

    public function improvement(Request $request, ParkingSpaceImprovement $improvement): Response|RedirectResponse
    {
        Gate::authorize('viewAny', ParkingSpaceImprovement::class);

        if ($improvement->status !== ParkingStatus::PENDING) {
            return $this->toQueue($request);
        }

        return $this->page($request, ModerationQueue::improvementKey($improvement->id), function () use ($improvement) {
            $review = $this->improvements->review($improvement);

            return [
                ...$review,
                'nearbySpaces' => $this->nearbySpaces($improvement->parkingSpace->latitude, $improvement->parkingSpace->longitude, $improvement->parking_space_id),
            ];
        });
    }

    public function report(Request $request, string $source, string $id): Response|RedirectResponse
    {
        Gate::authorize('viewAny', ParkingPlaceReport::class);

        $place = $this->reports->queue()->firstWhere('key', "{$source}:{$id}");
        if ($place === null) {
            return $this->toQueue($request);
        }

        return $this->page($request, ModerationQueue::reportKey($source, $id), fn () => [
            ...$place,
            'nearbySpaces' => $this->nearbySpaces($place['latitude'], $place['longitude'], $source === 'community' ? $id : null),
        ]);
    }

    /**
     * Publish a new submission, with the moderator's corrections when they made any.
     */
    public function approveSubmission(ParkingSpaceImprovementRequest $request, ParkingSpace $parkingSpace): RedirectResponse
    {
        Gate::authorize('update', $parkingSpace);
        abort_unless($parkingSpace->status === ParkingStatus::PENDING, 404);

        $corrections = $this->improvements->corrections(
            $parkingSpace,
            (float) $request->validated('latitude'),
            (float) $request->validated('longitude'),
            $request->parkingSpaceDetails(),
        );

        $next = $this->queue->after($request->user(), ModerationQueue::submissionKey($parkingSpace->id), $this->filters($request));
        $this->decideSubmission($parkingSpace, fn (ParkingSpace $space) => $space
            ->fill([...$corrections, 'status' => ParkingStatus::APPROVED])
            ->saveReviewedBy($request->user()));

        Inertia::flash('success', __('parking_spaces.moderation.submission_approved'));

        return $this->continueWith($request, $next);
    }

    public function rejectSubmission(Request $request, ParkingSpace $parkingSpace): RedirectResponse
    {
        Gate::authorize('update', $parkingSpace);
        abort_unless($parkingSpace->status === ParkingStatus::PENDING, 404);

        $validated = $request->validate([
            'reason' => ['required', Rule::enum(RejectionReason::class)],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $next = $this->queue->after($request->user(), ModerationQueue::submissionKey($parkingSpace->id), $this->filters($request));
        $this->decideSubmission($parkingSpace, fn (ParkingSpace $space) => $space
            ->fill(['status' => ParkingStatus::REJECTED])
            ->saveReviewedBy($request->user(), RejectionReason::from($validated['reason']), $this->note($validated)));

        Inertia::flash('success', __('parking_spaces.moderation.submission_rejected'));

        return $this->continueWith($request, $next);
    }

    /**
     * Apply the proposal as the moderator left it.
     */
    public function approveImprovement(ParkingSpaceImprovementRequest $request, ParkingSpaceImprovement $improvement): RedirectResponse
    {
        Gate::authorize('review', ParkingSpaceImprovement::class);
        abort_unless($improvement->status === ParkingStatus::PENDING, 404);

        $changes = $this->improvements->changes(
            $improvement->parkingSpace,
            (float) $request->validated('latitude'),
            (float) $request->validated('longitude'),
            $request->parkingSpaceDetails(),
        );

        $next = $this->queue->after($request->user(), ModerationQueue::improvementKey($improvement->id), $this->filters($request));
        $this->improvements->approve($improvement, $request->user(), $changes);

        Inertia::flash('success', __('parking_spaces.moderation.improvement_approved'));

        return $this->continueWith($request, $next);
    }

    public function rejectImprovement(Request $request, ParkingSpaceImprovement $improvement): RedirectResponse
    {
        Gate::authorize('review', ParkingSpaceImprovement::class);
        abort_unless($improvement->status === ParkingStatus::PENDING, 404);

        $validated = $request->validate([
            'reason' => ['required', Rule::enum(ImprovementRejectionReason::class)],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $next = $this->queue->after($request->user(), ModerationQueue::improvementKey($improvement->id), $this->filters($request));
        $this->improvements->reject([$improvement->id], $request->user(), ImprovementRejectionReason::from($validated['reason']), $this->note($validated));

        Inertia::flash('success', __('parking_spaces.moderation.improvement_rejected'));

        return $this->continueWith($request, $next);
    }

    /**
     * Keep a reported place published, also when its existence remains uncertain.
     */
    public function keep(Request $request, string $source, string $id): RedirectResponse
    {
        Gate::authorize('resolve', ParkingPlaceReport::class);
        $place = $this->reportedPlace($source, $id);

        $next = $this->queue->after($request->user(), ModerationQueue::reportKey($source, $id), $this->filters($request));
        $this->reports->keep($place, $request->user());

        Inertia::flash('success', __('parking_spaces.moderation.kept'));

        return $this->continueWith($request, $next);
    }

    /**
     * Delete a reported community place or hide a municipal one; destructive moderation always needs a reason.
     */
    public function remove(Request $request, string $source, string $id): RedirectResponse
    {
        Gate::authorize('resolve', ParkingPlaceReport::class);
        $place = $this->reportedPlace($source, $id);

        $validated = $request->validate([
            'reason' => ['required', Rule::enum(RemovalReason::class)],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $next = $this->queue->after($request->user(), ModerationQueue::reportKey($source, $id), $this->filters($request));
        $this->reports->remove($place, $request->user(), RemovalReason::from($validated['reason']), $this->note($validated));

        Inertia::flash('success', __($source === 'community' ? 'parking_spaces.moderation.deleted' : 'parking_spaces.moderation.hidden'));

        return $this->continueWith($request, $next);
    }

    /**
     * Reject several open submissions and improvements at once with one reason, for example spam.
     */
    public function bulkReject(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'max:100'],
            'items.*' => ['string', 'regex:/^(submission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|improvement:[0-9]+)$/i'],
            'reason' => ['required', Rule::in(self::bulkReasons())],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $ids = collect($validated['items'])->map(fn (string $key) => explode(':', $key, 2))->groupBy(0)->map->pluck(1);
        $submissions = $ids->get(ModerationQueue::SUBMISSION, collect())->all();
        $improvements = $ids->get(ModerationQueue::IMPROVEMENT, collect())->map(fn (string $id) => (int) $id)->all();
        $note = $this->note($validated);

        if ($submissions !== []) {
            Gate::authorize('bulkUpdate', ParkingSpace::class);
        }
        if ($improvements !== []) {
            Gate::authorize('review', ParkingSpaceImprovement::class);
        }

        $count = 0;
        DB::transaction(function () use ($submissions, $request, $validated, $note, &$count) {
            ParkingSpace::whereKey($submissions)->where('status', ParkingStatus::PENDING)->lockForUpdate()->get()
                ->each(function (ParkingSpace $space) use ($request, $validated, $note, &$count) {
                    $space->fill(['status' => ParkingStatus::REJECTED])->saveReviewedBy($request->user(), RejectionReason::from($validated['reason']), $note);
                    $count++;
                });
        });

        if ($improvements !== []) {
            $count += $this->improvements->reject($improvements, $request->user(), ImprovementRejectionReason::from($validated['reason']), $note);
        }

        Inertia::flash('success', trans_choice('parking_spaces.moderation.items_rejected', $count, ['count' => $count]));

        return back();
    }

    /**
     * Decide a submission only while it is still pending; a concurrent decision waits for the lock, then finds it decided.
     *
     * @param  callable(ParkingSpace): void  $decide
     */
    private function decideSubmission(ParkingSpace $parkingSpace, callable $decide): void
    {
        DB::transaction(function () use ($parkingSpace, $decide) {
            $space = ParkingSpace::whereKey($parkingSpace->getKey())->lockForUpdate()->firstOrFail();
            if ($space->status !== ParkingStatus::PENDING) {
                throw ValidationException::withMessages(['general' => __('parking_spaces.moderation.already_decided')]);
            }

            $decide($space);
        });
    }

    /**
     * Reasons that fit both a submission and an improvement, the only ones offered when rejecting in bulk.
     *
     * @return list<string>
     */
    public static function bulkReasons(): array
    {
        return array_values(array_intersect(
            array_column(RejectionReason::cases(), 'value'),
            array_column(ImprovementRejectionReason::cases(), 'value'),
        ));
    }

    /**
     * The inbox, with the item under review when one is open.
     *
     * The queue, history and options are closures, so switching between items reloads only the item; the queue feeds
     * several props and is built at most once per filter set in a request.
     */
    private function page(Request $request, ?string $selectedKey = null, ?callable $details = null): Response
    {
        $user = $request->user();
        $types = $this->queue->typesFor($user);
        abort_if($types === [], 403);

        $filters = $this->filters($request);
        $open = $request->input('status') !== 'decided';

        $built = [];
        $items = function (array $filters = []) use ($user, &$built): Collection {
            return $built[serialize($filters)] ??= $this->queue->items($user, $filters);
        };

        return Inertia::render('backend/moderation/index', [
            'status' => $open ? 'open' : 'decided',
            'filters' => [
                'types' => $filters['types'] ?? [],
                'municipality_ids' => array_map('strval', $filters['municipality_ids'] ?? []),
                'search' => $filters['search'] ?? null,
            ],
            'items' => fn () => $open ? $this->openPage($request, $items($filters)) : null,
            'history' => fn () => $open ? null : $this->history->page($user, $filters),
            'selected' => fn () => $selectedKey === null ? null : [
                ...$items($filters)->firstWhere('key', $selectedKey)
                    ?? $items()->firstWhere('key', $selectedKey)
                    ?? [],
                'details' => $details(),
            ],
            'position' => fn () => $selectedKey === null ? null : $this->position($items($filters), $selectedKey),
            'options' => fn () => [
                'types' => $types,
                'municipalities' => Municipality::whereIn('id', $items()->pluck('municipality_id')->filter()->unique())
                    ->orderBy('name')->get(['id', 'name']),
                'orientations' => ParkingOrientation::mapped(),
                'underSign' => UnderSign::mapped(),
                'restrictionDays' => ParkingSpace::RESTRICTION_DAYS,
                'changes' => array_keys(ParkingSpaceImprovements::CHANGE_GROUPS),
                'reasons' => [
                    ModerationQueue::SUBMISSION => RejectionReason::mapped(),
                    ModerationQueue::IMPROVEMENT => ImprovementRejectionReason::mapped(),
                    ModerationQueue::REPORT => RemovalReason::mapped(),
                ],
                'bulkReasons' => array_values(array_filter(RejectionReason::mapped(), fn (array $reason) => in_array($reason['value'], self::bulkReasons(), true))),
                'can' => [
                    ModerationQueue::SUBMISSION => $user->can('bulkUpdate', ParkingSpace::class),
                    ModerationQueue::IMPROVEMENT => $user->can('review', ParkingSpaceImprovement::class),
                    ModerationQueue::REPORT => $user->can('resolve', ParkingPlaceReport::class),
                ],
            ],
        ]);
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $items
     */
    private function openPage(Request $request, Collection $items): LengthAwarePaginator
    {
        $page = min(max(1, (int) $request->query('page', '1')), max(1, (int) ceil($items->count() / self::PER_PAGE)));

        return (new LengthAwarePaginator($items->forPage($page, self::PER_PAGE)->values(), $items->count(), self::PER_PAGE, $page, [
            'path' => route('app.moderation.index'),
        ]))->withQueryString();
    }

    /**
     * The item's place in the queue, with links to its neighbours.
     *
     * @param  Collection<int, array<string, mixed>>  $items
     * @return array{index: int, total: int, previous: ?array<string, mixed>, next: ?array<string, mixed>}
     */
    private function position(Collection $items, string $key): array
    {
        $position = $this->queue->position($items, $key);
        $link = fn (?array $item) => $item === null ? null : ['type' => $item['type'], 'route' => $item['route']];

        return [...$position, 'previous' => $link($position['previous']), 'next' => $link($position['next'])];
    }

    /**
     * The queue filters from the query string; decisions carry them so the queue continues in the same view.
     *
     * @return array{types?: list<string>, municipality_ids?: list<int>, search?: ?string}
     */
    private function filters(Request $request): array
    {
        $text = fn (string $key) => is_string($request->query($key)) ? trim($request->query($key)) : '';
        $list = fn (string $key) => array_values(array_filter(explode(',', $text($key))));

        return array_filter([
            'types' => array_values(array_intersect($list('type'), ModerationQueue::TYPES)),
            'municipality_ids' => array_map('intval', array_filter($list('municipality_id'), 'ctype_digit')),
            'search' => $text('search') ?: null,
        ], fn (mixed $value) => $value !== [] && $value !== null);
    }

    /**
     * @param  ?array<string, mixed>  $next
     */
    private function continueWith(Request $request, ?array $next): RedirectResponse
    {
        $query = $this->carriedQuery($request);

        return $next === null
            ? redirect()->route('app.moderation.index', $query)
            : redirect()->route("app.moderation.{$next['type']}s.show", [...$next['route'], ...$query]);
    }

    /**
     * The view a moderator was working in, carried into the next address.
     *
     * @return array<string, string>
     */
    private function carriedQuery(Request $request): array
    {
        return array_filter(
            $request->query->all(),
            fn (mixed $value, string $key) => is_string($value) && $value !== '' && in_array($key, ['type', 'municipality_id', 'search', 'page'], true),
            ARRAY_FILTER_USE_BOTH,
        );
    }

    private function toQueue(Request $request): RedirectResponse
    {
        return redirect()->route('app.moderation.index', $this->carriedQuery($request));
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function note(array $validated): ?string
    {
        return filled($validated['note'] ?? null) ? trim($validated['note']) : null;
    }

    /**
     * Nearby published community places, for the map beside the item.
     *
     * @return Collection<int, ParkingSpace>
     */
    private function nearbySpaces(float $latitude, float $longitude, ?string $except): Collection
    {
        return ParkingSpace::select('id', 'latitude', 'longitude', 'status')
            ->when($except, fn ($query) => $query->whereKeyNot($except))
            ->where('status', ParkingStatus::APPROVED)
            ->nearestTo(new GeoPoint($latitude, $longitude))
            ->limit(10)
            ->get();
    }

    private function reportedPlace(string $source, string $id): ParkingSpace|ParkingMunicipal
    {
        return $this->places->place($source, $id)->whereHas('reports', fn ($reports) => $reports->open())->firstOrFail();
    }
}
