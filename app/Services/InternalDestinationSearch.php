<?php

namespace App\Services;

final class InternalDestinationSearch
{
    public function __construct(private ParkingTextSearch $parkingSearch) {}

    /** @return list<array{key: string, label: string, sub: ?string, type: string, latitude: float, longitude: float}> */
    public function search(string $query, int $limit = 5): array
    {
        $result = $this->parkingSearch->search($query, $limit);

        return collect($result['hits'])->take($limit)->map(fn (array $hit): array => [
            'key' => 'internal:'.$hit['type'].':'.$hit['id'],
            'label' => $hit['label'],
            'sub' => $hit['sub'],
            'type' => $hit['type'],
            'latitude' => (float) $hit['lat'],
            'longitude' => (float) $hit['lng'],
        ])->values()->all();
    }
}
