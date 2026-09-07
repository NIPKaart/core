<?php

namespace App\Http\Resources;

use App\Enums\ParkingStatus;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FavoriteResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $favoritable = $this->favoritable;
        $typeMap = [
            ParkingSpace::class => 'Community',
            ParkingMunicipal::class => 'Municipal',
            ParkingOffstreet::class => 'Offstreet',
        ];

        $available = match (true) {
            $favoritable instanceof ParkingSpace => $favoritable->status === ParkingStatus::APPROVED,
            $favoritable instanceof ParkingMunicipal, $favoritable instanceof ParkingOffstreet => $favoritable->visibility,
            default => false,
        };

        if (! $available) {
            $favoritable = null;
        }

        return [
            'favorite_id' => $this->id,
            'id' => $this->favoritable_id,
            'available' => $available,
            'type' => $typeMap[$this->favoritable_type] ?? 'Unknown',
            'title' => $favoritable->title ?? $favoritable->street ?? $favoritable->name ?? '',
            'latitude' => $favoritable?->latitude,
            'longitude' => $favoritable?->longitude,
            'municipality' => is_object($favoritable?->municipality)
                ? ['id' => $favoritable->municipality->id, 'name' => $favoritable->municipality->name]
                : null,
            'city' => $favoritable->city ?? null,
            'country' => $favoritable->country->name ?? null,
        ];
    }
}
