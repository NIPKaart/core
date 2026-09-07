<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ParkingConfirmationStatus;
use App\Http\Controllers\Controller;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceConfirmation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ParkingSpaceConfirmationController extends Controller
{
    public function store(Request $request, ParkingSpace $parkingSpace)
    {
        $request->validate([
            'status' => ['required', 'string', Rule::in(ParkingConfirmationStatus::all())],
            'comment' => ['nullable', 'string', 'max:500'],
        ]);

        $user = Auth::user();

        DB::transaction(function () use ($parkingSpace, $user, $request) {
            // Serialize submissions for this space before checking the existing daily rule.
            $space = ParkingSpace::whereKey($parkingSpace->id)->lockForUpdate()->firstOrFail();
            $now = now();
            $alreadyConfirmed = $space->confirmations()
                ->where('user_id', $user->id)
                ->whereDate('confirmed_at', $now->toDateString())
                ->exists();

            if ($alreadyConfirmed) {
                throw ValidationException::withMessages([
                    'general' => 'You already confirmed this space today.',
                ]);
            }

            $space->confirmations()->create([
                'user_id' => $user->id,
                'confirmed_at' => $now,
                'status' => $request->input('status'),
                'comment' => $request->input('comment'),
            ]);
        });

        return redirect()->back()->with('success', 'Confirmation recorded successfully.');
    }

    public function index(Request $request, ParkingSpace $parkingSpace)
    {
        Gate::authorize('viewAny', ParkingSpaceConfirmation::class);

        $confirmations = ParkingSpaceConfirmation::with('user')
            ->where('parking_space_id', $parkingSpace->id)
            ->orderByDesc('created_at')
            ->paginate(20);

        return Inertia::render('backend/parking-spaces/confirmations/index', [
            'parkingSpace' => $parkingSpace->only('id', 'country_id', 'municipality', 'city', 'street'),
            'confirmations' => $confirmations,
            'options' => [
                'confirmationStatuses' => ParkingConfirmationStatus::options(),
            ],
        ]);
    }

    public function destroy(ParkingSpace $parking_space, ParkingSpaceConfirmation $confirmation)
    {
        Gate::authorize('delete', $confirmation);

        // Check if the confirmation belongs to the parking space
        if ($confirmation->parking_space_id !== $parking_space->id) {
            abort(404);
        }

        $confirmation->delete();

        return back();
    }

    public function bulkDelete(Request $request, ParkingSpace $parkingSpace)
    {
        Gate::authorize('bulkDelete', ParkingSpaceConfirmation::class);

        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', Rule::exists('parking_space_confirmations', 'id')->where('parking_space_id', $parkingSpace->id)],
        ]);

        $parkingSpace->confirmations()->whereIn('id', $validated['ids'])->delete();

        return back();
    }
}
