<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\ParkingDiscovery;
use App\Support\GeoBounds;
use App\Support\GeoPoint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
}
