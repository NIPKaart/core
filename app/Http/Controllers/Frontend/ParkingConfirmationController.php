<?php

namespace App\Http\Controllers\Frontend;

use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Models\ParkingMunicipal;
use App\Models\ParkingSpace;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * Records that a signed-in user confirms a published parking place exists, whichever source describes it.
 *
 * A confirmation says nothing about the place's details; improvements are a separate action.
 */
class ParkingConfirmationController extends Controller
{
    public function store(Request $request, string $source, string $id): RedirectResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($source, $id, $user) {
            // Locking the place serializes submissions before checking the once-per-day rule.
            $place = $this->publishedPlace($source, $id)->lockForUpdate()->firstOrFail();

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

    /**
     * Only places the public map shows can be confirmed.
     *
     * @return Builder<ParkingSpace>|Builder<ParkingMunicipal>
     */
    private function publishedPlace(string $source, string $id): Builder
    {
        return match ($source) {
            'community' => ParkingSpace::whereKey(Str::isUuid($id) ? $id : abort(404))->where('status', ParkingStatus::APPROVED),
            'municipal' => ParkingMunicipal::whereKey($id)->where('visibility', true),
        };
    }
}
