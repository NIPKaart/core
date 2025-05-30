<?php

namespace App\Http\Controllers;

use App\Enums\ParkingConfirmationStatus;
use App\Models\ParkingSpot;
use App\Models\ParkingSpotConfirmation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ParkingSpotConfirmationController extends Controller
{
    public function store(Request $request, ParkingSpot $parkingSpot)
    {
        $request->validate([
            'status' => ['required', 'string', Rule::in(ParkingConfirmationStatus::all())],
            'comment' => ['nullable', 'string', 'max:500'],
        ]);

        $user = Auth::user();

        $alreadyConfirmed = $parkingSpot->confirmations()
            ->where('user_id', $user->id)
            ->whereDate('confirmed_at', now()->toDateString())
            ->exists();

        if ($alreadyConfirmed) {
            return redirect()->back()->withErrors([
                'general' => 'You already confirmed this spot today.',
            ])->withInput();
        }

        $parkingSpot->confirmations()->create([
            'user_id' => $user->id,
            'confirmed_at' => now(),
            'status' => $request->input('status'),
            'comment' => $request->input('comment') ?? null,
        ]);

        return redirect()->back()->with('success', 'Confirmation recorded successfully.');
    }

    public function index(Request $request, ParkingSpot $parkingSpot)
    {
        Gate::authorize('viewAny', [ParkingSpotConfirmation::class, $parkingSpot]);

        $confirmations = ParkingSpotConfirmation::with('user')
            ->where('parking_spot_id', $parkingSpot->id)
            ->orderByDesc('created_at')
            ->paginate(20);

        return Inertia::render('backend/parking-spots/confirmations/index', [
            'parkingSpot' => $parkingSpot->only('id', 'country_id', 'municipality', 'city', 'street'),
            'confirmations' => $confirmations,
            'statuses' => ParkingConfirmationStatus::all(),
        ]);
    }

    public function destroy(ParkingSpot $parking_spot, ParkingSpotConfirmation $confirmation)
    {
        Gate::authorize('delete', $confirmation);

        // Check if the confirmation belongs to the parking spot
        if ($confirmation->parking_spot_id !== $parking_spot->id) {
            abort(404);
        }

        $confirmation->delete();

        return back();
    }

    public function bulkDelete(Request $request)
    {
        Gate::authorize('bulkDelete', ParkingSpotConfirmation::class);

        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['string', 'exists:parking_spot_confirmations,id'],
        ]);

        ParkingSpotConfirmation::whereIn('id', $validated['ids'])->delete();

        return back();
    }
}
