<?php

namespace App\Services;

use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;

class MunicipalProvenance
{
    public function deliveryStatus(DatasetSource $source): string
    {
        $hours = $this->lateAfterHours($source);
        if ($hours === null) {
            return 'unknown';
        }
        $latest = $source->latestImport?->retrieved_at;
        $expectedSince = $latest ?? $source->created_at;
        if ($expectedSince?->lt(now()->subHours($hours))) {
            return 'overdue';
        }

        return $latest ? 'current' : 'awaiting';
    }

    /** A delivery is late after a configured number of the source's expected intervals. */
    public function lateAfterHours(DatasetSource $source): ?int
    {
        $intervals = config('dataset-deliveries.late_after_intervals');

        return $source->expected_interval_hours > 0 && is_int($intervals) && $intervals > 0 ? $source->expected_interval_hours * $intervals : null;
    }

    /**
     * Source, attribution and terms of the published import behind a municipal space or offstreet facility.
     *
     * @return array<string, mixed>
     */
    public function publicDetails(ParkingMunicipal|ParkingOffstreet $space): array
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
    public function importTimes(DatasetImport $import): array
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
