<?php

namespace App\Http\Controllers\Api;

use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Models\ParkingMunicipal;
use App\Models\ParkingRule;
use App\Models\ParkingSpace;

class SpacesInfoController extends Controller
{
    public function ParkingSpaceInfo(string $id)
    {
        $location = ParkingSpace::with(['country', 'province', 'municipality'])
            ->where('id', $id)
            ->where('status', ParkingStatus::APPROVED)
            ->firstOrFail();

        $rule = ParkingRule::where('municipality', $location->municipality)->first();
        // Fallback to nationwide rule if no municipal rule is found
        if (empty($rule)) {
            $rule = ParkingRule::where([
                ['country_id', $location->country_id],
                ['nationwide', 1],
            ])->first();
        }

        // Check if the user has favorited this location
        $user = auth()->user();
        $isFavorited = $user ? $location->favoritedByUsers()->where('user_id', $user->id)->exists() : false;

        // Count the number of confirmed confirmations
        $confirmedCount = $location->confirmations()
            ->where('status', 'confirmed')
            ->count();

        // Get the last confirmed confirmation date
        $lastConfirmed = $location->confirmations()
            ->where('status', 'confirmed')
            ->latest('confirmed_at')
            ->value('confirmed_at');

        // If the user confirmed this location today
        $confirmedToday = $user ? $location->confirmations()
            ->where('user_id', $user->id)
            ->whereDate('confirmed_at', now()->toDateString())
            ->exists() : false;

        return response()->json([
            'id' => $location->id,
            'municipality' => $location->municipality->name ?? null,
            'province' => $location->province->name ?? null,
            'country' => $location->country->name ?? null,
            'orientation' => $location->orientation,
            'street' => $location->street,
            'amenity' => $location->amenity,
            'description' => $location->description,
            'rule_url' => $rule ? $rule->url : null,
            'parking_time' => $location->parking_time,
            'created_at' => $location->created_at,
            'is_favorited' => $isFavorited,
            'confirmed_today' => $confirmedToday,
            'confirmations_count' => [
                'confirmed' => $confirmedCount,
            ],
            'last_confirmed_at' => $lastConfirmed,
        ]);
    }

    public function ParkingMunicipalInfo(string $id) {
        $location = ParkingMunicipal::with(['country', 'province', 'municipality'])
            ->where('id', $id)
            ->where('visible', true)
            ->firstOrFail();

        $rule = ParkingRule::where('municipality', $location->municipality)->first();
        // Fallback to nationwide rule if no municipal rule is found
        if (empty($rule)) {
            $rule = ParkingRule::where([
                ['country_id', $location->country_id],
                ['nationwide', 1],
            ])->first();
        }

        // Check if the user has favorited this location
        $user = auth()->user();
        $isFavorited = $user ? $location->favoritedByUsers()->where('user_id', $user->id)->exists() : false;

        return response()->json([
            'id' => $location->id,
            'municipality' => $location->municipality->name ?? null,
            'province' => $location->province->name ?? null,
            'country' => $location->country->name ?? null,
            'orientation' => $location->orientation ?? null,
            'street' => $location->street ?? null,
            'rule_url' => $rule ? $rule->url : null,
            'updated_at' => $location->updated_at,
            'is_favorited' => $isFavorited,
        ]);
    }
}
