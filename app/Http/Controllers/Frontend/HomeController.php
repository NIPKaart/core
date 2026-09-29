<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\ParkingOffstreet;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    /** Garages shown in the home page's live preview. */
    private const int PREVIEW_SIZE = 3;

    /**
     * Frontend - Render the home page: destination search first, with a live preview of garages that still have room.
     */
    public function index(): Response
    {
        return Inertia::render('frontend/home', ['garages' => $this->garagePreview()]);
    }

    /**
     * The municipality with the most current measurements and its garages with the most free spaces.
     * Null when no garage has a current measurement, so the page never presents stale occupancy as live.
     *
     * @return array{municipality: array{name: string, garages: list<array<string, mixed>>}, total: int}|null
     */
    private function garagePreview(): ?array
    {
        $municipalities = ParkingOffstreet::query()
            ->with('municipality:id,name')
            ->where('visibility', true)
            ->get()
            ->groupBy(fn (ParkingOffstreet $garage): string => $garage->municipality->name);

        $current = $municipalities
            ->map(fn (Collection $garages): Collection => $garages->filter(fn (ParkingOffstreet $garage): bool => $garage->availability() === 'current' && $garage->free_space !== null))
            ->filter(fn (Collection $garages): bool => $garages->isNotEmpty())
            ->sortByDesc(fn (Collection $garages): int => $garages->count());

        $name = $current->keys()->first();
        if ($name === null) {
            return null;
        }

        return [
            'municipality' => [
                'name' => $name,
                'garages' => $current[$name]->sortByDesc('free_space')->take(self::PREVIEW_SIZE)->map(fn (ParkingOffstreet $garage): array => $garage->overview())->values()->all(),
            ],
            'total' => $municipalities[$name]->count(),
        ];
    }
}
