<?php

namespace App\Http\Controllers\User;

use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Models\ParkingSpot;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MyParkingSpotController extends Controller
{
    /**
     * Display a list of cards with the user's parking spots.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $locations = ParkingSpot::where('user_id', $user->id)
            ->latest()
            ->get();

        return Inertia::render('backend/user/parking-index', [
            'parkingSpots' => $locations,
        ]);
    }

    /**
     * Display the specified location.
     */
    public function show(String $id)
    {
        $spot = ParkingSpot::with(['province', 'country'])->withTrashed()->findOrFail($id);

        if ($spot->user_id !== auth()->id()) {
            abort(403, 'Unauthorized action.');
        }

        $statuses = collect(ParkingStatus::cases())->map(fn ($status) => [
            'value' => $status->value,
            'label' => $status->label(),
            'description' => $status->description(),
        ])->values();

        return Inertia::render('backend/user/parking-show', [
            'spot' => $spot,
            'selectOptions' => [
                'statuses' => $statuses,
            ],
        ]);
    }

    /**
     * Destroy the specified location if it belongs to the authenticated user.
     */
    public function destroy(String $id) 
    {
        $spot = ParkingSpot::withTrashed()->findOrFail($id);
        if ($spot->user_id !== auth()->id()) {
            abort(403, 'Unauthorized action.');
        }
        $spot->delete();
        return redirect()->route('user.parking-spots.index');
    }
}
