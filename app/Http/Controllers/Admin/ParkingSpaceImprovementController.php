<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ImprovementRejectionReason;
use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Enums\UnderSign;
use App\Http\Controllers\Controller;
use App\Http\Requests\ParkingSpaceImprovementRequest;
use App\Models\Municipality;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceImprovement;
use App\Services\ParkingSpaceImprovements;
use App\Support\GeoPoint;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Moderation of proposed improvements to community parking spaces.
 *
 * Moderators work through the open queue one proposal at a time: they take over, adjust or leave out each change
 * and approve, or reject with a reason, and move on to the next. Decided proposals stay browsable as history.
 */
class ParkingSpaceImprovementController extends Controller
{
    public function __construct(private ParkingSpaceImprovements $improvements) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', ParkingSpaceImprovement::class);

        $open = $request->input('status') !== 'decided';
        $filters = [
            'search' => $request->string('search')->trim()->value() ?: null,
            'municipality_ids' => $this->list($request, 'municipality_id', integers: true),
            'changes' => $this->list($request, 'changes'),
            'decisions' => $this->list($request, 'decision'),
        ];

        return Inertia::render('backend/improvements/index', [
            'status' => $open ? 'open' : 'decided',
            'improvements' => $this->improvements->list($open, $filters),
            'filters' => [...$filters, 'municipality_ids' => array_map('strval', $filters['municipality_ids'])],
            'pendingCount' => $this->improvements->pendingCount(),
            'options' => [
                ...$this->options(),
                'municipalities' => Municipality::whereHas('parkingSpaces', fn ($spaces) => $spaces->whereHas('improvements'))
                    ->orderBy('name')->get(['id', 'name']),
                'rejectionReasons' => ImprovementRejectionReason::mapped(),
            ],
        ]);
    }

    /**
     * Open the oldest proposal in the queue, or the queue itself when it is empty.
     */
    public function start(): RedirectResponse
    {
        Gate::authorize('review', ParkingSpaceImprovement::class);

        $first = ParkingSpaceImprovement::pending()->oldest()->orderBy('id')->value('id');

        return $first ? redirect()->route('app.improvements.show', $first) : redirect()->route('app.improvements.index');
    }

    public function show(ParkingSpaceImprovement $improvement): Response|RedirectResponse
    {
        Gate::authorize('viewAny', ParkingSpaceImprovement::class);

        if ($improvement->status !== ParkingStatus::PENDING) {
            return redirect()->route('app.improvements.index', ['status' => 'decided']);
        }

        $space = $improvement->parkingSpace;

        return Inertia::render('backend/improvements/show', [
            'improvement' => $this->improvements->review($improvement),
            'position' => $this->improvements->position($improvement),
            'nearbySpaces' => ParkingSpace::select('id', 'latitude', 'longitude', 'status')
                ->whereKeyNot($space->id)
                ->where('status', ParkingStatus::APPROVED)
                ->nearestTo(new GeoPoint($space->latitude, $space->longitude))
                ->limit(10)
                ->get(),
            'options' => [
                ...$this->options(),
                'underSign' => UnderSign::mapped(),
                'restrictionDays' => ParkingSpace::RESTRICTION_DAYS,
                'rejectionReasons' => ImprovementRejectionReason::mapped(),
            ],
        ]);
    }

    /**
     * Apply the proposal as the moderator left it, then continue with the next open proposal.
     */
    public function approve(ParkingSpaceImprovementRequest $request, ParkingSpaceImprovement $improvement): RedirectResponse
    {
        Gate::authorize('review', ParkingSpaceImprovement::class);
        $this->ensurePending($improvement);

        $this->improvements->approve($improvement, $request->user(), $this->improvements->changes(
            $improvement->parkingSpace,
            (float) $request->validated('latitude'),
            (float) $request->validated('longitude'),
            $request->parkingSpaceDetails(),
        ));

        Inertia::flash('success', __('parking_spaces.moderation.improvement_approved'));

        return $this->continueAfter($improvement);
    }

    public function reject(Request $request, ParkingSpaceImprovement $improvement): RedirectResponse
    {
        Gate::authorize('review', ParkingSpaceImprovement::class);
        $this->ensurePending($improvement);

        $validated = $this->validateRejection($request);
        $this->improvements->reject([$improvement->id], $request->user(), ImprovementRejectionReason::from($validated['reason']), $validated['note'] ?? null);

        Inertia::flash('success', __('parking_spaces.moderation.improvement_rejected'));

        return $this->continueAfter($improvement);
    }

    /**
     * Reject several open proposals at once, for example spam; approving always happens one proposal at a time.
     */
    public function bulkReject(Request $request): RedirectResponse
    {
        Gate::authorize('review', ParkingSpaceImprovement::class);

        $validated = [
            ...$this->validateRejection($request),
            ...$request->validate(['ids' => ['required', 'array', 'max:100'], 'ids.*' => ['integer']]),
        ];

        $count = $this->improvements->reject($validated['ids'], $request->user(), ImprovementRejectionReason::from($validated['reason']), $validated['note'] ?? null);

        Inertia::flash('success', trans_choice('parking_spaces.moderation.improvements_rejected', $count, ['count' => $count]));

        return back();
    }

    /**
     * @return array{reason: string, note?: ?string}
     */
    private function validateRejection(Request $request): array
    {
        return $request->validate([
            'reason' => ['required', Rule::enum(ImprovementRejectionReason::class)],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);
    }

    private function continueAfter(ParkingSpaceImprovement $improvement): RedirectResponse
    {
        $next = $this->improvements->nextAfter($improvement);

        return $next ? redirect()->route('app.improvements.show', $next) : redirect()->route('app.improvements.index');
    }

    private function ensurePending(ParkingSpaceImprovement $improvement): void
    {
        abort_unless($improvement->status === ParkingStatus::PENDING, 404);
    }

    /**
     * A comma-separated filter from the query string.
     *
     * @return list<string>|list<int>
     */
    private function list(Request $request, string $key, bool $integers = false): array
    {
        $values = array_values(array_filter(explode(',', (string) $request->input($key, ''))));

        return $integers ? array_map('intval', array_filter($values, 'ctype_digit')) : $values;
    }

    /**
     * @return array<string, mixed>
     */
    private function options(): array
    {
        return [
            'orientations' => ParkingOrientation::mapped(),
            'changes' => array_keys(ParkingSpaceImprovements::CHANGE_GROUPS),
        ];
    }
}
