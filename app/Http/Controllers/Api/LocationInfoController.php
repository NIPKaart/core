<?php

namespace App\Http\Controllers\Api;

use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Models\ParkingRule;
use App\Models\ParkingSpot;

class LocationInfoController extends Controller
{
    public function getLocationInfo(string $id)
    {
        $location = ParkingSpot::with(['country', 'province'])
            ->where('id', $id)
            ->where('status', ParkingStatus::APPROVED)
            ->firstOrFail();

        $rule = ParkingRule::where('municipality', $location->municipality)->first();
        // Fallback to nationwide rule if no municipal rule is found
        if (empty($rule)) {
            $rule = ParkingRule::where([
                ['country_id', $location->country_id],
                ['nationwide', 1]
            ])->first();
        }

        return response()->json([
            'id' => $location->id,
            'orientation' => $location->orientation,
            'municipality' => $location->municipality,
            'province' => $location->province->name ?? null,
            'country' => $location->country->name ?? null,
            'street' => $location->street,
            'amenity' => $location->amenity,
            'description' => $location->description,
            'rule_url' => $rule ? $rule->url : null,
            'parking_time' => $location->parking_time,
            'created_at' => $location->created_at,
        ]);
    }
}
