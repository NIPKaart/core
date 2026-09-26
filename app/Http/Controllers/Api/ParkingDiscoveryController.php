<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ParkingDiscovery;
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
}
