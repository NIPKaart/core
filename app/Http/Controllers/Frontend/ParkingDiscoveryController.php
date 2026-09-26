<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\ParkingDiscovery;
use App\Support\GeoBounds;
use App\Support\GeoPoint;
use App\Support\MapTile;
use App\Support\ParkingResult;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use InvalidArgumentException;

final class ParkingDiscoveryController extends Controller
{
    public function nearby(Request $request, ParkingDiscovery $discovery): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'radius' => ['sometimes', 'integer', 'min:50', 'max:10000'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:200'],
        ]);

        return response()->json([
            'results' => $discovery->withinRadius(
                new GeoPoint((float) $validated['latitude'], (float) $validated['longitude']),
                (float) ($validated['radius'] ?? 1000),
                (int) ($validated['limit'] ?? 100),
            ),
        ]);
    }

    public function viewport(Request $request, ParkingDiscovery $discovery): JsonResponse
    {
        $validated = $request->validate([
            'west' => ['required', 'numeric', 'between:-180,180'],
            'south' => ['required', 'numeric', 'between:-90,90'],
            'east' => ['required', 'numeric', 'between:-180,180'],
            'north' => ['required', 'numeric', 'between:-90,90'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:500'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:1000000'],
            'origin_latitude' => ['required_with:origin_longitude', 'numeric', 'between:-90,90'],
            'origin_longitude' => ['required_with:origin_latitude', 'numeric', 'between:-180,180'],
        ]);

        $limit = (int) ($validated['limit'] ?? 500);
        $page = (int) ($validated['page'] ?? 1);
        $results = $discovery->inViewport(
            new GeoBounds(
                (float) $validated['west'],
                (float) $validated['south'],
                (float) $validated['east'],
                (float) $validated['north'],
            ),
            $limit + 1,
            ($page - 1) * $limit,
            isset($validated['origin_latitude'])
                ? new GeoPoint((float) $validated['origin_latitude'], (float) $validated['origin_longitude'])
                : null,
        );

        return response()->json([
            'results' => $results->take($limit)->values(),
            'has_more' => $results->count() > $limit,
            'page' => $page,
        ]);
    }

    /**
     * Which areas contain public parking, as [x, y, count] at the area zoom.
     */
    public function areas(ParkingDiscovery $discovery): JsonResponse
    {
        return $this->cached('areas', fn (): array => ['zoom' => ParkingDiscovery::AREA_ZOOM, 'areas' => $discovery->areaIndex()]);
    }

    /**
     * Every public record of one area in a compact form, for clustering in the browser.
     */
    public function area(int $x, int $y, ParkingDiscovery $discovery): JsonResponse
    {
        $area = $this->tile(ParkingDiscovery::AREA_ZOOM, $x, $y);

        return $this->cached("area:{$area->key()}", function () use ($discovery, $area): array {
            $result = $discovery->area($area);

            return [...$result, 'points' => array_map(fn (ParkingResult $point): array => $point->toCompactArray(), $result['points'])];
        });
    }

    private function tile(int $zoom, int $x, int $y): MapTile
    {
        try {
            return new MapTile($zoom, $x, $y);
        } catch (InvalidArgumentException) {
            abort(404);
        }
    }

    /**
     * Publication changes (moderation, imports) may take up to the stale window to appear on the map.
     *
     * @param  callable(): array<string, mixed>  $payload
     */
    private function cached(string $key, callable $payload): JsonResponse
    {
        return response()->json(Cache::flexible("parking-discovery:{$key}", [30, 120], $payload));
    }
}
