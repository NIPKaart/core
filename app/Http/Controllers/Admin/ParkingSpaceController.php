<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\App\UpdateParkingSpace;
use App\Models\Country;
use App\Models\Municipality;
use App\Models\ParkingSpace;
use App\Models\Province;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ParkingSpaceController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        Gate::authorize('viewAny', ParkingSpace::class);

        $query = ParkingSpace::query()
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
            'filters' => [
                'status' => $request->input('status'),
                'municipality_id' => $request->input('municipality_id'),
                'deletion_requested' => $request->boolean('deletion_requested'),
            ],
            'options' => [
                'statuses' => ParkingStatus::options(),
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
    public function show(ParkingSpace $parkingSpace)
    {
        Gate::authorize('view', $parkingSpace);

        $parkingSpace = ParkingSpace::with(['user', 'province', 'country', 'municipality'])->findOrFail($parkingSpace->id);

        $parkingStatuses = collect(ParkingStatus::cases())->map(fn ($status) => [
            'value' => $status->value,
            'label' => $status->label(),
            'description' => $status->description(),
        ])->values();

        $confirmationStatuses = collect(ParkingConfirmationStatus::cases())->map(fn ($status) => [
            'value' => $status->value,
            'label' => $status->label(),
            'description' => $status->description(),
        ])->values();

        // Get the 10 nearest parking spaces
        $limit = 10;
        $nearbySpaces = ParkingSpace::select('id', 'latitude', 'longitude', 'status')
            ->where('id', '!=', $parkingSpace->id)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->orderByRaw('
                (6371 * acos(
                    cos(radians(?)) *
                    cos(radians(latitude)) *
                    cos(radians(longitude) - radians(?)) +
                    sin(radians(?)) *
                    sin(radians(latitude))
                ))
            ', [
                $parkingSpace->latitude,
                $parkingSpace->longitude,
                $parkingSpace->latitude,
            ])
            ->limit($limit)
            ->get();

        // Fetch the 8 most recent confirmations
        $recentConfirmations = $parkingSpace->confirmations()
            ->with('user')
            ->latest('confirmed_at')
            ->take(8)
            ->get();

        return inertia('backend/parking-spaces/show', [
            'parkingSpace' => $parkingSpace,
            'selectOptions' => [
                'parkingStatuses' => $parkingStatuses,
                'confirmationStatuses' => $confirmationStatuses,
            ],
            'nearbySpaces' => $nearbySpaces,
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

        $statuses = collect(ParkingStatus::cases())->map(fn ($status) => [
            'value' => $status->value,
            'label' => $status->label(),
            'description' => $status->description(),
        ])->values();

        // Get the 10 nearest parking spaces
        $limit = 10;
        $nearbySpaces = ParkingSpace::select('id', 'latitude', 'longitude', 'status')
            ->where('id', '!=', $parkingSpace->id)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->orderByRaw('
                (6371 * acos(
                    cos(radians(?)) *
                    cos(radians(latitude)) *
                    cos(radians(longitude) - radians(?)) +
                    sin(radians(?)) *
                    sin(radians(latitude))
                ))
            ', [
                $parkingSpace->latitude,
                $parkingSpace->longitude,
                $parkingSpace->latitude,
            ])
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
                'statuses' => $statuses,
                'orientation' => ParkingOrientation::options(),
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

        $parkingTime = ($request->integer('parking_hours') ?? 0) * 60 + ($request->integer('parking_minutes') ?? 0);

        $data = [
            ...$request->validated(),
            'parking_time' => $parkingTime > 0 ? $parkingTime : null,
            'parking_disc' => $parkingTime > 0,
        ];
        unset($data['parking_hours'], $data['parking_minutes']);

        $parkingSpace->update($data);

        return redirect()
            ->route('app.parking-spaces.index')
            ->with('success', 'Parking space updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ParkingSpace $parkingSpace)
    {
        Gate::authorize('delete', $parkingSpace);
        $parkingSpace->delete();

        return redirect()->route('app.parking-spaces.index')
            ->with('success', 'Parking space moved to trash successfully.');
    }

    /**
     * Bulk update the specified resource in storage.
     */
    public function bulkUpdate(Request $request)
    {
        Gate::authorize('bulkUpdate', ParkingSpace::class);

        $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'string', 'exists:parking_spaces,id'],
            'status' => ['required', 'string', Rule::in(ParkingStatus::all())],
        ]);

        ParkingSpace::whereIn('id', $request->input('ids'))
            ->update(['status' => $request->input('status')]);

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
            'ids.*' => ['string', 'exists:parking_spaces,id'],
        ]);

        ParkingSpace::onlyTrashed()
            ->whereIn('id', $validated['ids'])
            ->restore();

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
            'ids.*' => ['string', 'exists:parking_spaces,id'],
        ]);

        ParkingSpace::onlyTrashed()
            ->whereIn('id', $validated['ids'])
            ->forceDelete();

        return back();
    }
}
