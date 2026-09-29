<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\ParkingPlaces;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * Records a signed-in user's report that a published parking place no longer exists.
 *
 * The report goes to moderation; the place stays on the map until a moderator decides otherwise.
 */
class ParkingReportController extends Controller
{
    public function store(Request $request, ParkingPlaces $places, string $source, string $id): RedirectResponse
    {
        $validated = $request->validate([
            'note' => ['nullable', 'string', 'max:500'],
        ]);
        $user = $request->user();

        DB::transaction(function () use ($places, $source, $id, $user, $validated) {
            // Locking the place serializes submissions before checking for this user's open report.
            $place = $places->published($source, $id)->lockForUpdate()->firstOrFail();

            if ($place->isReportedBy($user)) {
                throw ValidationException::withMessages([
                    'general' => __('parking_spaces.report.already_open'),
                ]);
            }

            $place->reports()->create([
                'user_id' => $user->id,
                'note' => filled($validated['note'] ?? null) ? trim($validated['note']) : null,
            ]);
        });

        Inertia::flash('success', __('parking_spaces.report.recorded'));

        return back();
    }
}
