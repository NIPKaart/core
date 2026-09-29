<?php

namespace App\Http\Controllers\Frontend;

use App\Enums\ParkingConfirmationStatus;
use App\Http\Controllers\Controller;
use App\Services\ParkingPlaces;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * Records that a signed-in user confirms a published parking place exists, whichever source describes it.
 *
 * A confirmation says nothing about the place's details; improvements are a separate action.
 */
class ParkingConfirmationController extends Controller
{
    public function store(Request $request, ParkingPlaces $places, string $source, string $id): RedirectResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($places, $source, $id, $user) {
            // Locking the place serializes submissions before checking the once-per-day rule.
            $place = $places->published($source, $id)->lockForUpdate()->firstOrFail();

            if ($place->isConfirmedTodayBy($user)) {
                throw ValidationException::withMessages([
                    'general' => __('parking_spaces.confirm.already_today'),
                ]);
            }

            $place->confirmations()->create([
                'user_id' => $user->id,
                'confirmed_at' => now(),
                'status' => ParkingConfirmationStatus::CONFIRMED,
            ]);
        });

        Inertia::flash('success', __('parking_spaces.confirm.recorded'));

        return back();
    }
}
