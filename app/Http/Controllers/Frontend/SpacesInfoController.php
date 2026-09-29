<?php

namespace App\Http\Controllers\Frontend;

use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingRule;
use App\Models\ParkingSpace;
use App\Services\MunicipalProvenance;

class SpacesInfoController extends Controller
{
    public function ParkingSpaceInfo(string $id)
    {
        $location = ParkingSpace::with(['country', 'province', 'municipality'])
            ->where('id', $id)
            ->where('status', ParkingStatus::APPROVED)
            ->firstOrFail();

        $rule = ParkingRule::where('municipality_id', $location->municipality_id)->first();
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
            'latitude' => $location->latitude,
            'longitude' => $location->longitude,
            'country' => $location->country->name ?? null,
            'province' => $location->province->name ?? null,
            'municipality' => $location->municipality->name ?? null,
            'orientation' => $location->orientation->toArray(),
            'street' => $location->street,
            'amenity' => $location->amenity,
            'description' => $location->description,
            'rule_url' => $rule ? $rule->url : null,
            'parking_time' => $location->parking_time,
            'under_sign' => $location->under_sign?->toArray(),
            'under_sign_text' => $location->under_sign_text,
            'restriction_days' => $location->restriction_days,
            'restriction_starts_at' => $location->restriction_starts_at ? substr($location->restriction_starts_at, 0, 5) : null,
            'restriction_ends_at' => $location->restriction_ends_at ? substr($location->restriction_ends_at, 0, 5) : null,
            'created_at' => $location->created_at,
            'updated_at' => $location->updated_at,
            'is_favorited' => $isFavorited,
            'confirmed_today' => $confirmedToday,
            'confirmations_count' => [
                'confirmed' => $confirmedCount,
            ],
            'last_confirmed_at' => $lastConfirmed,
        ]);
    }

    public function ParkingMunicipalInfo(string $id, MunicipalProvenance $provenance)
    {
        $location = ParkingMunicipal::with(['country', 'province', 'municipality', 'publishedImport:id,dataset_source_id,state,retrieved_at,dataset_config'])
            ->where('id', $id)
            ->where('visibility', true)
            ->firstOrFail();

        $rule = ParkingRule::where('municipality_id', $location->municipality_id)->first();
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
            'latitude' => $location->latitude,
            'longitude' => $location->longitude,
            'country' => $location->country->name ?? null,
            'province' => $location->province->name ?? null,
            'municipality' => $location->municipality->name ?? null,
            'provenance' => $provenance->publicDetails($location),
            'orientation' => $location->orientation?->toArray(),
            'street' => $location->street ?? null,
            'rule_url' => $rule ? $rule->url : null,
            'updated_at' => $location->updated_at,
            'is_favorited' => $isFavorited,
        ]);
    }

    public function ParkingOffstreetInfo(string $id)
    {
        $location = ParkingOffstreet::with(['country', 'province', 'municipality'])
            ->where('id', $id)
            ->where('visibility', true)
            ->firstOrFail();

        // Check if the user has favorited this location
        $user = auth()->user();
        $isFavorited = $user ? $location->favoritedByUsers()->where('user_id', $user->id)->exists() : false;

        return response()->json([
            'id' => $location->id,
            'latitude' => $location->latitude,
            'longitude' => $location->longitude,
            'name' => $location->name,
            'type' => $location->parking_type,
            'country' => $location->country->name ?? null,
            'province' => $location->province->name ?? null,
            'municipality' => $location->municipality->name ?? null,
            ...$location->publicOccupancy(),
            'url' => $location->url ?? null,
            'prices' => $location->prices ?? null,
            'updated_at' => $location->updated_at,
            'is_favorited' => $isFavorited,
        ]);
    }
}
