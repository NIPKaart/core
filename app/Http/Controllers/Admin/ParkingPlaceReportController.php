<?php

namespace App\Http\Controllers\Admin;

use App\Enums\RemovalReason;
use App\Http\Controllers\Controller;
use App\Models\ParkingMunicipal;
use App\Models\ParkingPlaceReport;
use App\Models\ParkingSpace;
use App\Services\ParkingPlaceModeration;
use App\Services\ParkingPlaces;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The moderation queue of parking places reported as no longer existing.
 */
class ParkingPlaceReportController extends Controller
{
    public function __construct(private ParkingPlaceModeration $moderation, private ParkingPlaces $places) {}

    public function index(): Response
    {
        Gate::authorize('viewAny', ParkingPlaceReport::class);

        return Inertia::render('backend/reports/index', [
            'places' => $this->moderation->queue(),
            'options' => [
                'removalReasons' => RemovalReason::mapped(),
            ],
        ]);
    }

    /**
     * Keep the place published, also when its existence remains uncertain.
     */
    public function keep(Request $request, string $source, string $id): RedirectResponse
    {
        Gate::authorize('resolve', ParkingPlaceReport::class);

        $this->moderation->keep($this->reportedPlace($source, $id), $request->user());

        Inertia::flash('success', __('parking_spaces.moderation.kept'));

        return back();
    }

    /**
     * Delete a community place or hide a municipal one; destructive moderation always needs a reason.
     */
    public function remove(Request $request, string $source, string $id): RedirectResponse
    {
        Gate::authorize('resolve', ParkingPlaceReport::class);

        $validated = $request->validate([
            'reason' => ['required', Rule::enum(RemovalReason::class)],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $this->moderation->remove(
            $this->reportedPlace($source, $id),
            $request->user(),
            RemovalReason::from($validated['reason']),
            $validated['note'] ?? null,
        );

        Inertia::flash('success', __($source === 'community' ? 'parking_spaces.moderation.deleted' : 'parking_spaces.moderation.hidden'));

        return back();
    }

    private function reportedPlace(string $source, string $id): ParkingSpace|ParkingMunicipal
    {
        return $this->places->place($source, $id)->whereHas('reports', fn ($reports) => $reports->open())->firstOrFail();
    }
}
