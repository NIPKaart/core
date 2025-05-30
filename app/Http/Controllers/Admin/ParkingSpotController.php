<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\App\UpdateParkingSpot;
use App\Models\Country;
use App\Models\ParkingSpot;
use App\Models\Province;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

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

        $parkingSpot = ParkingSpot::with(['user', 'province', 'country'])->findOrFail($parkingSpot->id);

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

        // Get the 10 nearest parking spots
        $limit = 10;
        $nearbySpots = ParkingSpot::select('id', 'latitude', 'longitude', 'status')
            ->where('id', '!=', $parkingSpot->id)
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
                $parkingSpot->latitude,
                $parkingSpot->longitude,
                $parkingSpot->latitude,
            ])
            ->limit($limit)
            ->get();

        // Fetch the 8 most recent confirmations
        $recentConfirmations = $parkingSpot->confirmations()
            ->with('user')
            ->latest('confirmed_at')
            ->take(8)
            ->get();

        return inertia('backend/parking-spots/show', [
            'parkingSpot' => $parkingSpot,
            'selectOptions' => [
                'parkingStatuses' => $parkingStatuses,
                'confirmationStatuses' => $confirmationStatuses,
            ],
            'nearbySpots' => $nearbySpots,
            'recentConfirmations' => $recentConfirmations,
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(ParkingSpot $parkingSpot)
    {
        Gate::authorize('update', $parkingSpot);

        $parkingSpot = ParkingSpot::with(['user', 'province', 'country'])->findOrFail($parkingSpot->id);

        $parkingSpot->parking_hours = $parkingSpot->parking_time ? floor($parkingSpot->parking_time / 60) : 0;
        $parkingSpot->parking_minutes = $parkingSpot->parking_time ? $parkingSpot->parking_time % 60 : 0;

        $statuses = collect(ParkingStatus::cases())->map(fn ($status) => [
            'value' => $status->value,
            'label' => $status->label(),
            'description' => $status->description(),
        ])->values();

        // Get the 10 nearest parking spots
        $limit = 10;
        $nearbySpots = ParkingSpot::select('id', 'latitude', 'longitude', 'status')
            ->where('id', '!=', $parkingSpot->id)
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
                $parkingSpot->latitude,
                $parkingSpot->longitude,
                $parkingSpot->latitude,
            ])
            ->limit($limit)
            ->get();

        $countries = Country::select('id', 'name')->get();
        $provinces = Province::select('id', 'name')->get();

        return inertia('backend/parking-spots/edit', [
            'parkingSpot' => $parkingSpot,
            'countries' => $countries,
            'provinces' => $provinces,
            'selectOptions' => [
                'statuses' => $statuses,
                'orientation' => ParkingOrientation::options(),
            ],
            'nearbySpots' => $nearbySpots,
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

        return redirect()->route('app.parking-spots.index')
            ->with('success', 'Parking spot moved to trash successfully.');
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
            ->with(['user', 'province', 'country'])
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
