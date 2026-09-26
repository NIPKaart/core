<?php

namespace App\Contracts;

interface DestinationGeocoder
{
    /** @return list<array{key: string, label: string, sub: ?string, type: string, latitude: float, longitude: float}> */
    public function autocomplete(string $query, int $limit = 5): array;

    /** @return array{key: string, label: string, sub: ?string, type: string, latitude: float, longitude: float}|null */
    public function resolve(string $query): ?array;
}
