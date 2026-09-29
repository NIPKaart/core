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

        return Inertia::render('backend/profile/parking/index', [
            'parkingSpaces' => $parkingSpaces,
            'selectOptions' => [
                'statuses' => ParkingStatus::mapped(),
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

        $rejection = $parkingSpace->status === ParkingStatus::REJECTED ? $parkingSpace->latestReview : null;

        return Inertia::render('backend/profile/parking/show', [
            'parkingSpace' => $parkingSpace,
            'rejectionReason' => $rejection?->reason?->label(),
            'canWithdraw' => $parkingSpace->status === ParkingStatus::PENDING && ! $parkingSpace->trashed(),
            'selectOptions' => [
                'statuses' => ParkingStatus::mapped(),
                'orientations' => ParkingOrientation::mapped(),
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

        // Once published, the place is community data and no longer the contributor's to remove.
        abort_unless($space->status === ParkingStatus::PENDING, 403, 'Only pending submissions can be withdrawn.');

        $space->delete();

        return redirect()->route('profile.parking-spaces.index');
    }
}
