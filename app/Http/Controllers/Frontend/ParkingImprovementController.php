<?php

namespace App\Http\Controllers\Frontend;

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\ParkingSpaceImprovementRequest;
use App\Models\ParkingSpace;
use App\Services\ParkingSpaceImprovements;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Lets any signed-in user propose an improvement to a published community parking space.
 *
 * The proposal goes to moderation; the space keeps its current information until a moderator approves it.
 */
class ParkingImprovementController extends Controller
{
    /**
     * Open the add flow on the space, filled with its current information.
     */
    public function create(ParkingSpace $parkingSpace): Response
    {
        $this->ensurePublished($parkingSpace);

        return Inertia::render('frontend/map/contribute', [
            'orientationOptions' => ParkingOrientation::mapped(),
            'restrictionDays' => ParkingSpace::RESTRICTION_DAYS,
            'parkingSpace' => $parkingSpace->only([
                'id', 'latitude', 'longitude', 'orientation', 'under_sign', 'under_sign_text', 'parking_time',
                'restriction_days', 'restriction_starts_at', 'restriction_ends_at', 'description',
            ]),
            'improving' => true,
        ]);
    }

    public function store(ParkingSpaceImprovementRequest $request, ParkingSpace $parkingSpace, ParkingSpaceImprovements $improvements): RedirectResponse
    {
        $this->ensurePublished($parkingSpace);

        $improvements->submit($parkingSpace, $request->user(), $improvements->changes(
            $parkingSpace,
            (float) $request->validated('latitude'),
            (float) $request->validated('longitude'),
            $request->parkingSpaceDetails(),
        ));

        Inertia::flash('success', __('parking_spaces.improve.submitted'));

        // Reopen the space on the map, which still shows its current information.
        return redirect()->route('location-map', [
            'place' => "community:{$parkingSpace->id}",
            'at' => sprintf('%.5f,%.5f', $parkingSpace->latitude, $parkingSpace->longitude),
        ]);
    }

    private function ensurePublished(ParkingSpace $parkingSpace): void
    {
        abort_unless($parkingSpace->status === ParkingStatus::APPROVED, 404);
    }
}
