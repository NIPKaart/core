<?php

namespace App\Support;

use JsonSerializable;

final readonly class ParkingResult implements JsonSerializable
{
    public function __construct(
        public string $key,
        public string $id,
        public string $source,
        public float $latitude,
        public float $longitude,
        public string $title,
        public ?float $distanceMetres = null,
    ) {}

    /** @param object{id: string, source: string, key: string, latitude: float|int|string, longitude: float|int|string, title: ?string, distance_metres: float|int|string|null} $row */
    public static function fromDatabaseRow(object $row): self
    {
        return new self(
            key: $row->key,
            id: $row->id,
            source: $row->source,
            latitude: (float) $row->latitude,
            longitude: (float) $row->longitude,
            title: $row->title ?? '',
            distanceMetres: $row->distance_metres === null ? null : (float) $row->distance_metres,
        );
    }

    /** @return array{key: string, id: string, source: string, latitude: float, longitude: float, title: string, distance_metres: float|null} */
    public function jsonSerialize(): array
    {
        return [
            'key' => $this->key,
            'id' => $this->id,
            'source' => $this->source,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'title' => $this->title,
            'distance_metres' => $this->distanceMetres,
        ];
    }
}
