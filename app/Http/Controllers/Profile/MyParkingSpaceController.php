<?php

namespace App\Http\Controllers\Profile;

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Models\ParkingSpace;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MyParkingSpaceController extends Controller
{
    /**
     * Display a list of cards with the user's parking spaces.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $parkingSpaces = ParkingSpace::where('user_id', $user->id)
            ->latest()
            ->get();

        // Get all parking statuses with their labels and descriptions
        $statuses = collect(ParkingStatus::cases())->map(fn ($status) => [
            'value' => $status->value,
            'label' => $status->label(),
            'description' => $status->description(),
        ])->values();

        return Inertia::render('backend/profile/parking/index', [
            'parkingSpaces' => $parkingSpaces,
            'selectOptions' => [
                'statuses' => $statuses,
            ],
        ]);
    }

    /**
     * Display the specified location.
     */
    public function show(string $id)
    {
        $parkingSpace = ParkingSpace::with(['province', 'country', 'municipality'])->withTrashed()->findOrFail($id);

        if ($parkingSpace->user_id !== auth()->id()) {
            abort(403, 'Unauthorized action.');
        }

        // Get all parking statuses with their labels and descriptions
        $statuses = collect(ParkingStatus::cases())->map(fn ($status) => [
            'value' => $status->value,
            'label' => $status->label(),
            'description' => $status->description(),
        ])->values();

        // Get all orientations with their labels and descriptions
        $orientations = collect(ParkingOrientation::cases())->map(fn ($orientation) => [
            'value' => $orientation->value,
            'label' => $orientation->label(),
            'description' => $orientation->description(),
        ])->values();

        return Inertia::render('backend/profile/parking/show', [
            'parkingSpace' => $parkingSpace,
            'selectOptions' => [
                'statuses' => $statuses,
                'orientations' => $orientations,
            ],
        ]);
    }

    /**
     * Destroy the specified location if it belongs to the authenticated user.
     */
    public function destroy(string $id)
    {
        $space = ParkingSpace::withTrashed()->findOrFail($id);
        if ($space->user_id !== auth()->id()) {
            abort(403, 'Unauthorized action.');
        }
        $space->delete();

        return redirect()->route('profile.parking-spaces.index');
    }
}
