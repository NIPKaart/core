<?php

namespace App\Services;

final class InternalDestinationSearch
{
    public function __construct(private ParkingTextSearch $parkingSearch) {}

    /** @return list<array{key: string, label: string, sub: ?string, type: string, latitude: float, longitude: float, parking_count: int, bounds: array{south: float, north: float, west: float, east: float}}> */
    public function search(string $query, int $limit = 5): array
    {
        $result = $this->parkingSearch->search($query, $limit, groupStreets: true);

        return collect($result['hits'])->take($limit)->map(fn (array $hit): array => [
            'key' => 'internal:'.$hit['type'].':'.$hit['id'],
            'label' => $hit['label'],
            'sub' => $hit['sub'],
            'type' => $hit['type'],
            'latitude' => (float) $hit['lat'],
            'longitude' => (float) $hit['lng'],
            'parking_count' => (int) $hit['parking_count'],
            'bounds' => [
                'south' => (float) $hit['south'],
                'north' => (float) $hit['north'],
                'west' => (float) $hit['west'],
                'east' => (float) $hit['east'],
            ],
        ])->values()->all();
    }
}
