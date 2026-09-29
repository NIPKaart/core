<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\ParkingOffstreet;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class GarageController extends Controller
{
    /**
     * Frontend - Render the live overview of visible garages and P+R facilities, grouped by municipality.
     * Occupancy follows the detail's freshness rules (#1221).
     */
    public function index(): Response
    {
        $municipalities = ParkingOffstreet::query()
            ->with('municipality:id,name')
            ->where('visibility', true)
            ->get()
            ->groupBy(fn (ParkingOffstreet $garage): string => $garage->municipality->name)
            ->sortKeys(SORT_NATURAL | SORT_FLAG_CASE)
            ->map(fn (Collection $garages, string $name): array => [
                'name' => $name,
                'garages' => $garages->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->map(fn (ParkingOffstreet $garage): array => $garage->overview())->values()->all(),
            ])
            ->values()
            ->all();

        return Inertia::render('frontend/garages', ['municipalities' => $municipalities]);
    }
}
