<?php

namespace App\Services;

use App\Contracts\DestinationGeocoder;

final class DestinationSearch
{
    public function __construct(
        private InternalDestinationSearch $internal,
        private DestinationGeocoder $external,
    ) {}

    public function suggestions(string $query, int $limit = 5): array
    {
        $internal = $this->internal->search($query, $limit);
        if (mb_strlen(trim($query)) < 3) {
            return $internal;
        }

        return collect([...$this->external->autocomplete($query, $limit), ...$internal])
            ->unique(fn (array $result): string => mb_strtolower($result['label']).'|'.round($result['latitude'], 5).'|'.round($result['longitude'], 5))
            ->take($limit)->values()->all();
    }

    public function resolve(string $query): ?array
    {
        return $this->external->resolve($query)
            ?? $this->internal->search($query, 1)[0]
            ?? null;
    }
}
