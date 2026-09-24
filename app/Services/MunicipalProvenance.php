<?php

namespace App\Services;

use App\Models\DatasetSource;
use App\Models\MunicipalImport;
use App\Models\ParkingMunicipal;

class MunicipalProvenance
{
    public function deliveryStatus(DatasetSource $source): string
    {
        $hours = config('municipal-deliveries.sources.'.$source->code.'.max_age_hours');
        if (! is_numeric($hours) || $hours <= 0) {
            return 'unknown';
        }
        $latest = $source->latestImport?->retrieved_at;
        $expectedSince = $latest ?? $source->created_at;
        if ($expectedSince?->lt(now()->subHours($hours))) {
            return 'overdue';
        }

        return $latest ? 'current' : 'awaiting';
    }

    /** @return array<string, mixed> */
    public function publicDetails(ParkingMunicipal $space): array
    {
        $import = $space->publishedImport;
        if ($import?->state !== 'published' || $import->dataset_source_id !== $space->dataset_source_id) {
            $import = null;
        }
        $config = $import?->dataset_config ?? [];

        return [
            'name' => $config['name'] ?? null,
            'attribution' => $config['attribution'] ?? null,
            'url' => $this->publicUrl($config['source_url'] ?? null),
            'terms_url' => $this->publicUrl($config['terms_url'] ?? null),
            'fetched_at' => $import?->retrieved_at?->toISOString(),
            'source_updated_at' => $import ? ($space->source_record['source_updated_at'] ?? null) : null,
        ];
    }

    /** @return array<string, mixed> */
    public function importTimes(MunicipalImport $import): array
    {
        $delivery = $import->delivery;

        return [
            'fetched_at' => $import->retrieved_at->toISOString(),
            'received_at' => $delivery?->received_at?->toISOString(),
            'validated_at' => $delivery?->validated_at?->toISOString(),
            'staged_at' => $import->created_at->toISOString(),
            'published_at' => $import->state === 'published' ? $import->reviewed_at?->toISOString() : null,
        ];
    }

    private function publicUrl(?string $url): ?string
    {
        if (! $url || ! filter_var($url, FILTER_VALIDATE_URL)) {
            return null;
        }
        $parts = parse_url($url);
        if (! in_array($parts['scheme'] ?? null, ['https', 'http'], true)
            || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) {
            return null;
        }

        return $url;
    }
}
