<?php

namespace App\Http\Controllers\Frontend;

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreLocationRequest;
use App\Models\ParkingSpace;
use App\Models\User;
use App\Notifications\CommunitySpace;
use App\Services\ParkingLocationResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The contributor's flow for adding a community parking place and editing it while it awaits moderation.
 */
class ParkingContributionController extends Controller
{
    /**
     * Show the add flow; the map position comes from the page URL, or from the device when none is given.
     */
    public function create(): Response
    {
        return Inertia::render('frontend/map/contribute', [
            ...$this->formOptions(),
            'parkingSpace' => null,
        ]);
    }

    /**
     * Resolve the address under the pin so the contributor sees where the place will be filed.
     */
    public function locate(Request $request, ParkingLocationResolver $resolver): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $location = $resolver->lookup((float) $validated['latitude'], (float) $validated['longitude']);
        if ($location === null) {
            return response()->json(['message' => __('parking_spaces.contribute.unresolved')], 422);
        }

        return response()->json([
            'street' => $location['street'],
            'municipality' => $location['municipality'],
            'province' => $location['province'],
            'country' => $location['country'],
        ]);
    }

    /**
     * Submit a new place for moderation.
     */
    public function store(StoreLocationRequest $request, ParkingLocationResolver $resolver): RedirectResponse
    {
        $location = $this->resolveLocation($request, $resolver);

        $parkingSpace = DB::transaction(fn (): ParkingSpace => ParkingSpace::create([
            'id' => (string) Str::uuid(),
            'user_id' => $request->user()->id,
            'ip_address' => $request->header('CF-Connecting-IP') ?? $request->ip(),
            'latitude' => $request->validated('latitude'),
            'longitude' => $request->validated('longitude'),
            ...$resolver->attributesFor($location),
            ...$request->parkingSpaceDetails(),
            'status' => ParkingStatus::PENDING,
        ]));

        Notification::send(
            User::role(['admin', 'moderator'])->get(),
            new CommunitySpace\Submitted($parkingSpace->id, $parkingSpace->street ?: "Space #{$parkingSpace->id}", submittedByUserId: $request->user()->id),
        );

        return redirect()->route('location-map.submitted', $parkingSpace);
    }

    /**
     * Confirm a submission to its contributor.
     */
    public function submitted(ParkingSpace $parkingSpace): Response
    {
        Gate::authorize('viewSubmission', $parkingSpace);

        return Inertia::render('frontend/map/submitted', [
            'parkingSpace' => $parkingSpace->load('municipality:id,name')->only([
                'id', 'latitude', 'longitude', 'street', 'orientation', 'under_sign', 'status', 'municipality',
            ]),
        ]);
    }

    /**
     * Reopen a pending submission in the add flow.
     */
    public function edit(ParkingSpace $parkingSpace): Response
    {
        Gate::authorize('updateSubmission', $parkingSpace);

        return Inertia::render('frontend/map/contribute', [
            ...$this->formOptions(),
            'parkingSpace' => $parkingSpace->only([
                'id', 'latitude', 'longitude', 'orientation', 'under_sign', 'under_sign_text', 'parking_time',
                'restriction_days', 'restriction_starts_at', 'restriction_ends_at', 'description',
            ]),
        ]);
    }

    /**
     * Save a contributor's changes to their pending submission.
     */
    public function update(StoreLocationRequest $request, ParkingSpace $parkingSpace, ParkingLocationResolver $resolver): RedirectResponse
    {
        Gate::authorize('updateSubmission', $parkingSpace);

        $location = $this->resolveLocation($request, $resolver);

        $parkingSpace->update([
            'latitude' => $request->validated('latitude'),
            'longitude' => $request->validated('longitude'),
            ...$resolver->attributesFor($location),
            ...$request->parkingSpaceDetails(),
        ]);

        Inertia::flash('success', __('parking_spaces.contribute.updated'));

        return redirect()->route('profile.parking-spaces.show', $parkingSpace->id);
    }

    /**
     * @return array{country_id: int, country: string, province: ?string, municipality: string, street: ?string, address: array<string, string>}
     */
    private function resolveLocation(StoreLocationRequest $request, ParkingLocationResolver $resolver): array
    {
        return $resolver->lookup((float) $request->validated('latitude'), (float) $request->validated('longitude'))
            ?? throw ValidationException::withMessages(['latitude' => __('parking_spaces.contribute.unresolved')]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(): array
    {
        return [
            'orientationOptions' => ParkingOrientation::mapped(),
            'restrictionDays' => ParkingSpace::RESTRICTION_DAYS,
        ];
    }
}
