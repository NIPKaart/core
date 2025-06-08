<?php

namespace App\Http\Resources;

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

        return [
            'id' => $favoritable->id,
            'type' => $typeMap[get_class($favoritable)] ?? 'Unknown',
            'title' => $favoritable->title ?? $favoritable->street ?? '',
            'latitude' => $favoritable->latitude,
            'longitude' => $favoritable->longitude,
            'municipality' => is_object($favoritable->municipality)
                ? ['id' => $favoritable->municipality->id, 'name' => $favoritable->municipality->name]
                : null,
            'city' => $favoritable->city ?? null,
            'country' => $favoritable->country->name ?? null,
        ];
    }
}
