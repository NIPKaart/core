<?php

namespace App\Http\Controllers\Profile;

use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Models\ParkingSpace;
use App\Services\UserActivity;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class MyParkingSpaceController extends Controller
{
    /**
     * Display a list of cards with the user's parking spaces.
     */
    public function index(Request $request): RedirectResponse
    {
        return redirect()->route('dashboard', ['section' => 'contributions']);
    }

    /**
     * Display the specified location.
     */
    public function show(string $id): RedirectResponse
    {
        $parkingSpace = ParkingSpace::with(['province', 'country', 'municipality'])->withTrashed()->findOrFail($id);

        if ($parkingSpace->user_id !== auth()->id()) {
            abort(403, 'Unauthorized action.');
        }

        if ($parkingSpace->status === ParkingStatus::APPROVED && ! $parkingSpace->trashed()) {
            return redirect(UserActivity::mapUrl($parkingSpace));
        }

        return $parkingSpace->status === ParkingStatus::PENDING && ! $parkingSpace->trashed()
            ? redirect()->route('location-map.edit', ['parking_space' => $parkingSpace->id])
            : redirect()->route('dashboard', ['section' => 'contributions']);
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
