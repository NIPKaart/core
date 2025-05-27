<?php

namespace App\Http\Resources;

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
        $type = class_basename($this->favoritable_type);
        $f = $this->favoritable;

        $result = [
            'id' => $f?->id,
            'type' => $type,
            'title' => $f?->street ?? $f?->name ?? '[deleted]',
            'municipality' => $f?->municipality ?? null,
            'city' => $f?->city ?? null,
            'country' => $f?->country?->name ?? null,
            'address' => $f?->address ?? null,
            'latitude' => $f?->latitude ?? null,
            'longitude' => $f?->longitude ?? null,
        ];

        return $result;
    }
}
