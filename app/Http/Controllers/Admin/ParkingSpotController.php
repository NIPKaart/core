<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\App\UpdateParkingSpot;
use App\Models\Country;
use App\Models\Province;
use App\Models\ParkingSpot;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ParkingSpotController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        Gate::authorize('viewAny', ParkingSpot::class);

        $query = ParkingSpot::query()
            ->with(['user', 'province', 'country']);

        if ($request->filled('status')) {
            $statuses = explode(',', $request->input('status'));
            $query->whereIn('status', $statuses);
        }

        if ($request->filled('municipality')) {
            $municipalities = explode(',', $request->input('municipality'));
            $query->whereIn('municipality', $municipalities);
        }

        $spots = $query->latest()->paginate(25)->withQueryString();

        return inertia('backend/parking-spots/index', [
            'spots' => $spots,
            'filters' => [
                'status' => $request->input('status'),
                'municipality' => $request->input('municipality'),
                'deletion_requested' => $request->boolean('deletion_requested'),
            ],
            'statuses' => ParkingStatus::options(),
            'municipalities' => ParkingSpot::select('municipality')->distinct()->orderBy('municipality')->pluck('municipality')->filter()->values(),
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
    public function show(ParkingSpot $parkingSpot)
    {
        Gate::authorize('view', $parkingSpot);

        $spot = ParkingSpot::with(['user', 'province', 'country'])->findOrFail($parkingSpot->id);

        $statuses = collect(ParkingStatus::cases())->map(fn ($status) => [
            'value' => $status->value,
            'label' => $status->label(),
            'description' => $status->description(),
        ])->values();

        return inertia('backend/parking-spots/show', [
            'spot' => $spot,
            'selectOptions' => [
                'statuses' => $statuses,
            ],
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(ParkingSpot $parkingSpot)
    {
        Gate::authorize('update', $parkingSpot);

        $spot = ParkingSpot::with(['user', 'province', 'country'])->findOrFail($parkingSpot->id);

        $statuses = collect(ParkingStatus::cases())->map(fn ($status) => [
            'value' => $status->value,
            'label' => $status->label(),
            'description' => $status->description(),
        ])->values();

        $countries = Country::select('id', 'name')->get();
        $provinces = Province::select('id', 'name')->get();

        return inertia('backend/parking-spots/edit', [
            'spot' => $spot,
            'countries' => $countries,
            'provinces' => $provinces,
            'selectOptions' => [
                'statuses' => $statuses,
                'orientation' => ParkingOrientation::options(),
            ],
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateParkingSpot $request, ParkingSpot $parkingSpot)
    {
        Gate::authorize('update', $parkingSpot);

        $parkingTime = ($request->integer('parking_hours') ?? 0) * 60 + ($request->integer('parking_minutes') ?? 0);

        $data = [
            ...$request->validated(),
            'parking_time' => $parkingTime > 0 ? $parkingTime : null,
            'parking_disc' => $parkingTime > 0,
        ];
        unset($data['parking_hours'], $data['parking_minutes']);

        $parkingSpot->update($data);

        return redirect()
            ->route('app.parking-spots.index')
            ->with('success', 'Parking spot updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ParkingSpot $parkingSpot)
    {
        Gate::authorize('delete', $parkingSpot);
        $parkingSpot->delete();

        return back();
    }

    /**
     * Bulk update the specified resource in storage.
     */
    public function bulkUpdate(Request $request)
    {
        Gate::authorize('bulkUpdate', ParkingSpot::class);

        $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'string', 'exists:parking_spots,id'],
            'status' => ['required', 'string', Rule::in(ParkingStatus::all())],
        ]);

        ParkingSpot::whereIn('id', $request->input('ids'))
            ->update(['status' => $request->input('status')]);

        return redirect()
            ->back()
            ->with('success', 'Parking spots updated successfully.');
    }

    /**
     * Display a listing of the trashed resources.
     */
    public function trash(Request $request)
    {
        Gate::authorize('viewAny', ParkingSpot::class);

        $spots = ParkingSpot::onlyTrashed()
            ->with(['user','province','country'])
            ->latest()
            ->paginate(25)
            ->withQueryString();

        return inertia('backend/parking-spots/trash', [
            'spots' => $spots,
        ]);
    }

    /**
     * Restore the specified resource from storage.
     */
    public function restore(string $id)
    {
        $spot = ParkingSpot::onlyTrashed()->findOrFail($id);

        Gate::authorize('restore', $spot);

        $spot->restore();

        return back();
    }

    /**
     * Permanently delete the specified resource from storage.
     */
    public function forceDelete(string $id)
    {
        $spot = ParkingSpot::onlyTrashed()->findOrFail($id);

        Gate::authorize('forceDelete', $spot);

        $spot->forceDelete();

        return back();
    }

    /**
     * Bulk restore the specified resources from storage.
     */
    public function bulkRestore(Request $request)
    {
        Gate::authorize('bulkRestore', ParkingSpot::class);

        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['string', 'exists:parking_spots,id'],
        ]);

        ParkingSpot::onlyTrashed()
            ->whereIn('id', $validated['ids'])
            ->restore();

        return back();
    }

    /**
     * Permanently delete the specified resources from storage.
     */
    public function bulkForceDelete(Request $request)
    {
        Gate::authorize('bulkForceDelete', ParkingSpot::class);

        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['string', 'exists:parking_spots,id'],
        ]);

        ParkingSpot::onlyTrashed()
            ->whereIn('id', $validated['ids'])
            ->forceDelete();

        return back();
    }
}
