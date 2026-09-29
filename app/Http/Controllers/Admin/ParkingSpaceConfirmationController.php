<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ParkingConfirmationStatus;
use App\Http\Controllers\Controller;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceConfirmation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ParkingSpaceConfirmationController extends Controller
{
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
