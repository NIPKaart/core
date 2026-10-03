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
use App\Models\Province;
use App\Services\NearbyMunicipalPlaces;
use App\Support\GeoPoint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ParkingSpaceController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request, NearbyMunicipalPlaces $nearbyMunicipalPlaces)
    {
        Gate::authorize('viewAny', ParkingSpace::class);

        $query = $nearbyMunicipalPlaces->withNearbyDistance(ParkingSpace::query())
            ->with(['user', 'province', 'country', 'municipality']);

        // Filters
        if ($request->filled('status')) {
            $statuses = explode(',', $request->input('status'));
            $query->whereIn('status', $statuses);
        }

        if ($request->filled('municipality_id')) {
            $municipalityIds = explode(',', $request->input('municipality_id'));
            $query->whereIn('municipality_id', $municipalityIds);
        }

        $spaces = $query->latest()->paginate(25)->withQueryString();

        return inertia('backend/parking-spaces/index', [
            'spaces' => $spaces,
            'trashedCount' => ParkingSpace::onlyTrashed()->count(),
            'filters' => [
                'status' => $request->input('status'),
                'municipality_id' => $request->input('municipality_id'),
                'deletion_requested' => $request->boolean('deletion_requested'),
            ],
            'options' => [
                'statuses' => ParkingStatus::options(),
                'rejectionReasons' => RejectionReason::mapped(),
                'municipalities' => Municipality::select('id', 'name')->orderBy('name')->get(),
            ],
        ]);
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
     * Display the specified resource.
     */
    public function show(ParkingSpace $parkingSpace, NearbyMunicipalPlaces $nearbyMunicipalPlaces)
    {
        Gate::authorize('view', $parkingSpace);

        $parkingSpace = $nearbyMunicipalPlaces->withNearbyDistance(ParkingSpace::query())
            ->with(['user', 'latestReview.reviewer:id,name', 'province', 'country', 'municipality'])
            ->findOrFail($parkingSpace->id);
        $location = new GeoPoint($parkingSpace->latitude, $parkingSpace->longitude);

        // Get the 10 nearest parking spaces
        $limit = 10;
        $nearbySpaces = ParkingSpace::select('id', 'latitude', 'longitude', 'status')
            ->where('id', '!=', $parkingSpace->id)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->nearestTo($location)
            ->limit($limit)
            ->get();

        // Visible municipal places around it, so the moderator sees what municipal data already covers
        $nearbyMunicipalSpaces = $nearbyMunicipalPlaces->around($location, $limit);

        // Fetch the 8 most recent confirmations
        $recentConfirmations = $parkingSpace->confirmations()
            ->with('user')
            ->latest('confirmed_at')
            ->take(8)
            ->get();

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
            'nearbyMunicipalSpaces' => $nearbyMunicipalSpaces,
            'recentConfirmations' => $recentConfirmations,
        ]);
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
     * Display a listing of the trashed resources.
     */
    public function trash(Request $request)
    {
        Gate::authorize('viewAny', ParkingSpace::class);

        $spaces = ParkingSpace::onlyTrashed()
            ->with(['user', 'province', 'country', 'municipality'])
            ->latest()
            ->paginate(25)
            ->withQueryString();

        return inertia('backend/parking-spaces/trash/index', [
            'spaces' => $spaces,
            'trashedCount' => $spaces->total(),
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
