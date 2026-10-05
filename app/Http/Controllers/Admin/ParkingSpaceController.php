<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Enums\RejectionReason;
use App\Enums\UnderSign;
use App\Http\Controllers\Controller;
use App\Http\Requests\App\UpdateParkingSpace;
use App\Models\Country;
use App\Models\Municipality;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceImprovement;
use App\Models\ParkingSpaceReview;
use App\Models\Province;
use App\Services\NearbyMunicipalPlaces;
use App\Services\ParkingSpaceImprovements;
use App\Services\UserActivity;
use App\Support\GeoPoint;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ParkingSpaceController extends Controller
{
    /**
     * Signals a moderator can filter the list on.
     */
    private const array SIGNALS = ['nearby_municipal', 'reports', 'improvement'];

    /**
     * Community parking spaces, one status at a time, searchable and with the signals that need attention on each row.
     */
    public function index(Request $request, NearbyMunicipalPlaces $nearbyMunicipalPlaces)
    {
        Gate::authorize('viewAny', ParkingSpace::class);

        $statuses = array_values(array_intersect(explode(',', (string) $request->input('status')), array_column(ParkingStatus::cases(), 'value')));
        $municipalities = array_filter(explode(',', (string) $request->input('municipality_id')), 'ctype_digit');
        $signals = array_values(array_intersect(explode(',', (string) $request->input('signal')), self::SIGNALS));
        $search = trim((string) $request->input('search'));
        $oldestFirst = $request->input('sort') === 'oldest';

        $query = $nearbyMunicipalPlaces->withNearbyDistance(ParkingSpace::query())
            ->with(['user' => fn (BelongsTo $user) => $user->select('id', 'name')->withCount('parkingSpaces'), 'province:id,name', 'municipality:id,name', 'latestReview'])
            ->withCount([
                'confirmations',
                'reports as open_reports_count' => fn (Builder $reports) => $reports->open(),
                'improvements as open_improvements_count' => fn (Builder $improvements) => $improvements->pending(),
            ])
            ->when($statuses !== [], fn (Builder $query) => $query->whereIn('status', $statuses))
            ->when($municipalities !== [], fn (Builder $query) => $query->whereIn('municipality_id', $municipalities))
            ->when($search !== '', function (Builder $query) use ($search) {
                $pattern = '%'.addcslashes($search, '%_\\').'%';

                $query->where(fn (Builder $match) => $match
                    ->where('street', 'ilike', $pattern)
                    ->orWhere('postcode', 'ilike', $pattern)
                    ->orWhere('city', 'ilike', $pattern)
                    ->orWhereHas('user', fn (Builder $user) => $user->where('name', 'ilike', $pattern)));
            })
            ->when(in_array('nearby_municipal', $signals, true), fn (Builder $query) => $nearbyMunicipalPlaces->whereNearby($query))
            ->when(in_array('reports', $signals, true), fn (Builder $query) => $query->whereHas('reports', fn (Builder $reports) => $reports->open()))
            ->when(in_array('improvement', $signals, true), fn (Builder $query) => $query->whereHas('improvements', fn (Builder $improvements) => $improvements->pending()));

        $spaces = ($oldestFirst ? $query->oldest() : $query->latest())->paginate(25)->withQueryString();

        return inertia('backend/parking-spaces/index', [
            'spaces' => $spaces,
            'tabCounts' => $this->counts(),
            'filters' => [
                'status' => $statuses === [] ? null : implode(',', $statuses),
                'municipality_id' => $municipalities === [] ? null : implode(',', $municipalities),
                'signal' => $signals === [] ? null : implode(',', $signals),
                'search' => $search,
                'sort' => $oldestFirst ? 'oldest' : 'newest',
            ],
            'options' => [
                'statuses' => ParkingStatus::options(),
                'rejectionReasons' => RejectionReason::mapped(),
                'municipalities' => Municipality::select('id', 'name')->orderBy('name')->get(),
            ],
        ]);
    }

    /**
     * How many parking spaces each status tab and the trash hold.
     *
     * @return array{all: int, pending: int, approved: int, rejected: int, trash: int}
     */
    private function counts(): array
    {
        $byStatus = ParkingSpace::query()->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return [
            'all' => (int) $byStatus->sum(),
            ...collect(array_column(ParkingStatus::cases(), 'value'))->mapWithKeys(fn (string $status) => [$status => (int) ($byStatus[$status] ?? 0)])->all(),
            'trash' => ParkingSpace::onlyTrashed()->count(),
        ];
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * One community parking space: where it is, what it says, who added it, what visitors confirmed and what happened to it.
     */
    public function show(ParkingSpace $parkingSpace, NearbyMunicipalPlaces $nearbyMunicipalPlaces, ParkingSpaceImprovements $improvements)
    {
        Gate::authorize('view', $parkingSpace);

        $parkingSpace = $nearbyMunicipalPlaces->withNearbyDistance(ParkingSpace::query())
            ->with(['user' => fn (BelongsTo $user) => $user->withCount([
                'parkingSpaces',
                'parkingSpaces as published_spaces_count' => fn (Builder $spaces) => $spaces->where('status', ParkingStatus::APPROVED),
            ]), 'province', 'country', 'municipality'])
            ->withCount(['reports as open_reports_count' => fn (Builder $reports) => $reports->open()])
            ->findOrFail($parkingSpace->id);
        $location = new GeoPoint($parkingSpace->latitude, $parkingSpace->longitude);

        $limit = 10;
        $nearbySpaces = ParkingSpace::select('id', 'latitude', 'longitude', 'status')
            ->where('id', '!=', $parkingSpace->id)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->nearestTo($location)
            ->limit($limit)
            ->get();

        $openImprovement = $parkingSpace->improvements()->pending()->with('user:id,name')->latest()->first();
        $confirmations = $parkingSpace->confirmations()->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return inertia('backend/parking-spaces/show', [
            'parkingSpace' => $parkingSpace,
            'selectOptions' => [
                'orientation' => ParkingOrientation::mapped(),
                'underSign' => UnderSign::mapped(),
                'rejectionReasons' => RejectionReason::mapped(),
                'parkingStatuses' => ParkingStatus::mapped(),
                'confirmationStatuses' => ParkingConfirmationStatus::mapped(),
            ],
            'nearbySpaces' => $nearbySpaces,
            'nearbyMunicipalSpaces' => $nearbyMunicipalPlaces->around($location, $limit),
            'openImprovement' => $openImprovement ? [
                'id' => $openImprovement->id,
                'proposer' => $openImprovement->user?->name,
                'proposed_at' => $openImprovement->created_at->toIso8601String(),
                'changes' => $improvements->changeGroups($openImprovement->submitted ?? []),
            ] : null,
            'confirmations' => [
                'counts' => collect(ParkingConfirmationStatus::cases())->mapWithKeys(fn (ParkingConfirmationStatus $status) => [$status->value => (int) ($confirmations[$status->value] ?? 0)])->all(),
                'total' => (int) $confirmations->sum(),
                'recent' => $parkingSpace->confirmations()->with('user:id,name')->latest('confirmed_at')->take(3)->get(),
            ],
            'history' => $this->history($parkingSpace),
            'mapUrl' => $parkingSpace->status === ParkingStatus::APPROVED ? UserActivity::mapUrl($parkingSpace) : null,
        ]);
    }

    /**
     * What happened to a parking space, newest first: proposed improvements, review decisions and its creation.
     *
     * @return list<array{kind: string, at: string, by: ?string, status?: string, reason?: ?string}>
     */
    private function history(ParkingSpace $parkingSpace): array
    {
        $reviews = $parkingSpace->reviews()->with('reviewer:id,name')->get()->map(fn (ParkingSpaceReview $review) => [
            'kind' => 'review',
            'at' => $review->reviewed_at->toIso8601String(),
            'by' => $review->reviewer?->name,
            'status' => $review->to_status->value,
            'reason' => $review->reason?->value,
        ]);
        $proposals = $parkingSpace->improvements()->with('user:id,name')->get()->map(fn (ParkingSpaceImprovement $improvement) => [
            'kind' => 'improvement',
            'at' => $improvement->created_at->toIso8601String(),
            'by' => $improvement->user?->name,
            'status' => $improvement->status->value,
        ]);

        return $reviews->concat($proposals)
            ->push(['kind' => 'added', 'at' => $parkingSpace->created_at->toIso8601String(), 'by' => $parkingSpace->user?->name])
            ->sortByDesc('at')
            ->values()
            ->all();
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(ParkingSpace $parkingSpace)
    {
        Gate::authorize('update', $parkingSpace);

        $parkingSpace = ParkingSpace::with(['user', 'province', 'country', 'municipality'])->findOrFail($parkingSpace->id);

        $parkingSpace->parking_hours = $parkingSpace->parking_time ? floor($parkingSpace->parking_time / 60) : 0;
        $parkingSpace->parking_minutes = $parkingSpace->parking_time ? $parkingSpace->parking_time % 60 : 0;

        // Get the 10 nearest parking spaces
        $limit = 10;
        $nearbySpaces = ParkingSpace::select('id', 'latitude', 'longitude', 'status')
            ->where('id', '!=', $parkingSpace->id)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->nearestTo(new GeoPoint($parkingSpace->latitude, $parkingSpace->longitude))
            ->limit($limit)
            ->get();

        $countries = Country::select('id', 'name')->get();
        $provinces = Province::select('id', 'name')->get();
        $municipalities = Municipality::select('id', 'name')->get();

        return inertia('backend/parking-spaces/edit', [
            'parkingSpace' => $parkingSpace,
            'countries' => $countries,
            'provinces' => $provinces,
            'municipalities' => $municipalities,
            'selectOptions' => [
                'statuses' => ParkingStatus::mapped(),
                'orientation' => ParkingOrientation::options(),
                'underSign' => UnderSign::mapped(),
                'rejectionReasons' => RejectionReason::mapped(),
                'restrictionDays' => ParkingSpace::RESTRICTION_DAYS,
            ],
            'nearbySpaces' => $nearbySpaces,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateParkingSpace $request, ParkingSpace $parkingSpace)
    {
        Gate::authorize('update', $parkingSpace);

        $parkingSpace->fill([
            ...$request->safe()->only(['country_id', 'province_id', 'municipality_id', 'city', 'suburb', 'neighbourhood', 'postcode', 'street', 'amenity', 'latitude', 'longitude', 'status']),
            ...$request->parkingSpaceDetails(),
        ])->saveReviewedBy(
            $request->user(),
            $request->enum('rejection_reason', RejectionReason::class),
            $request->validated('rejection_note'),
        );

        Inertia::flash('success', __('parking_spaces.flash.updated'));

        return redirect()
            ->route('app.parking-spaces.index');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ParkingSpace $parkingSpace)
    {
        Gate::authorize('delete', $parkingSpace);
        $parkingSpace->delete();

        return redirect()->route('app.parking-spaces.index');
    }

    /**
     * Reject several places at once, for example spam; approving always happens one place at a time.
     */
    public function bulkUpdate(Request $request)
    {
        Gate::authorize('bulkUpdate', ParkingSpace::class);

        $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'uuid', 'exists:parking_spaces,id'],
            'status' => ['required', 'string', Rule::in([ParkingStatus::REJECTED->value])],
            'rejection_reason' => ['required', Rule::enum(RejectionReason::class)],
            'rejection_note' => ['nullable', 'string', 'max:1000'],
        ]);

        ParkingSpace::whereIn('id', $request->input('ids'))
            ->eachById(fn (ParkingSpace $space) => $space->fill(['status' => $request->input('status')])->saveReviewedBy(
                $request->user(),
                $request->enum('rejection_reason', RejectionReason::class),
                $request->input('rejection_note'),
            ));

        return back();
    }

    /**
     * Move several parking spaces to the trash at once.
     */
    public function bulkDestroy(Request $request)
    {
        Gate::authorize('bulkDelete', ParkingSpace::class);

        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'uuid', 'exists:parking_spaces,id'],
        ]);

        ParkingSpace::whereIn('id', $validated['ids'])->eachById(fn (ParkingSpace $space) => $space->delete());

        return back();
    }

    /**
     * Parking spaces in the trash, newest deletion first.
     */
    public function trash(Request $request)
    {
        Gate::authorize('viewAny', ParkingSpace::class);

        $spaces = ParkingSpace::onlyTrashed()
            ->with(['user:id,name', 'province:id,name', 'municipality:id,name', 'latestReview'])
            ->latest('deleted_at')
            ->paginate(25)
            ->withQueryString();

        return inertia('backend/parking-spaces/trash/index', [
            'spaces' => $spaces,
            'tabCounts' => $this->counts(),
            'options' => [
                'statuses' => ParkingStatus::options(),
                'rejectionReasons' => RejectionReason::mapped(),
            ],
        ]);
    }

    /**
     * Restore the specified resource from storage.
     */
    public function restore(string $id)
    {
        $space = ParkingSpace::onlyTrashed()->findOrFail($id);

        Gate::authorize('restore', $space);

        $space->restore();

        return back();
    }

    /**
     * Permanently delete the specified resource from storage.
     */
    public function forceDelete(string $id)
    {
        $space = ParkingSpace::onlyTrashed()->findOrFail($id);

        Gate::authorize('forceDelete', $space);

        $space->forceDelete();

        return back();
    }

    /**
     * Bulk restore the specified resources from storage.
     */
    public function bulkRestore(Request $request)
    {
        Gate::authorize('bulkRestore', ParkingSpace::class);

        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['uuid', 'exists:parking_spaces,id'],
        ]);

        ParkingSpace::onlyTrashed()
            ->whereIn('id', $validated['ids'])
            ->eachById(fn (ParkingSpace $space) => $space->restore());

        return back();
    }

    /**
     * Permanently delete the specified resources from storage.
     */
    public function bulkForceDelete(Request $request)
    {
        Gate::authorize('bulkForceDelete', ParkingSpace::class);

        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['uuid', 'exists:parking_spaces,id'],
        ]);

        ParkingSpace::onlyTrashed()
            ->whereIn('id', $validated['ids'])
            ->eachById(fn (ParkingSpace $space) => $space->forceDelete());

        return back();
    }
}
