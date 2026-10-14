<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DestinationResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'label' => $this->label,
            'destination' => [
                'key' => $this->key,
                'label' => $this->name,
                'sub' => $this->sub,
                'type' => $this->type,
                'latitude' => $this->latitude,
                'longitude' => $this->longitude,
                ...($this->bounds ? ['bounds' => $this->bounds] : []),
            ],
        ];
    }
}
