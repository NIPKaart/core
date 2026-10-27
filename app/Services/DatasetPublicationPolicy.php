<?php

namespace App\Services;

use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/** Explains why a validated delivery can publish automatically or still needs an administrator. */
class DatasetPublicationPolicy
{
    /**
     * The caller holds the source lock and supplies a fresh, locked import review.
     *
     * @param  array<string, mixed>  $review
     * @return array{version: int, reasons: list<string>, counts: array<string, int>, reference_import_id: ?int, limits: array<string, int|float>}
     */
    public function assess(DatasetImport $import, DatasetSource $source, array $review): array
    {
        $limits = config('dataset-deliveries.automatic_publication.limits');
        $reasons = [];
        if (! $source->isApproved()) {
            $reasons[] = 'source_unapproved';
        }
        $previous = DatasetImport::where('dataset_source_id', $source->id)->where('state', 'published')
            ->select(['id', 'identity_resolution'])->selectRaw('jsonb_array_length(records) as record_count')
            ->where('retrieved_at', '<', $import->retrieved_at)->latest('retrieved_at')->first();
        if (! $previous || ! $source->last_published_retrieved_at) {
            $reasons[] = 'first_publication';
        }
        if ($review['blockers'] !== []) {
            $reasons[] = 'review_blocked';
        }
        if ($review['derivations'] > 0) {
            $reasons[] = 'geometry_review';
        }
        if ($review['counts']['conflict'] > 0) {
            $reasons[] = 'conflicts';
        }
        $currentCount = count($import->records);
        $previousCount = (int) ($previous?->record_count ?? 0);
        $previousSeen = $previous?->identity_resolution !== null
            ? array_fill_keys(array_filter(array_column($previous->identity_resolution, 'facility_id')), true) : null;
        $newlyMissing = $previousSeen === null ? $review['counts']['missing']
            : count(array_filter($review['rows'], fn (array $row): bool => $row['status'] === 'missing' && isset($previousSeen[$row['current']['id']])));
        if ($currentCount === 0 && $previousCount > 0) {
            $reasons[] = 'empty';
        }
        if ($this->exceeds($newlyMissing, $previousCount, $limits['missing_fraction'], $limits['missing_minimum'], $limits['missing_absolute'])) {
            $reasons[] = 'many_missing';
        }
        if ($previous && $this->exceeds($review['counts']['new'], $previousCount, $limits['growth_fraction'], $limits['growth_minimum'], $limits['growth_absolute'])) {
            $reasons[] = 'rapid_growth';
        }
        if ($this->hasLargeMovement($review['rows'], $limits['movement_metres'])) {
            $reasons[] = 'large_movement';
        }
        if ($import->retrieved_at->lt(now()->subHours($source->expected_interval_hours * config('dataset-deliveries.late_after_intervals')))) {
            $reasons[] = 'late_delivery';
        }

        // Keep a manually accepted anchor: a sequence of small losses must not reset its own baseline.
        $reference = DatasetImport::where('dataset_source_id', $source->id)->where('state', 'published')
            ->select(['id', 'retrieved_at', 'publication_checks'])->selectRaw('jsonb_array_length(records) as record_count')
            ->where(fn (Builder $query) => $query->where('publication_method', 'manual')->orWhereNotNull('reviewed_by'))
            ->where('retrieved_at', '<', $import->retrieved_at)->latest('retrieved_at')->first();
        if ($reference && $reference->id !== $previous?->id) {
            $referenceCount = (int) $reference->record_count;
            if ($this->exceeds(max(0, $referenceCount - $currentCount), $referenceCount, $limits['missing_fraction'], $limits['missing_minimum'], $limits['missing_absolute'])) {
                $reasons[] = 'gradual_decline';
            }
            if ($this->exceeds(max(0, $currentCount - $referenceCount), $referenceCount, $limits['growth_fraction'], $limits['growth_minimum'], $limits['growth_absolute'])) {
                $reasons[] = 'gradual_growth';
            }
        }
        if ($previous && $this->hasPersistentMissing($import, $source, $review['rows'], $limits, $reference)) {
            $reasons[] = 'persistent_missing';
        }

        return ['version' => 1, 'reasons' => $reasons, 'counts' => [...$review['counts'], 'newly_missing' => $newlyMissing], 'reference_import_id' => $reference?->id, 'limits' => $limits];
    }

    private function exceeds(int $count, int $baseline, float $fraction, int $minimum, int $absolute): bool
    {
        return $count > $absolute || ($count >= $minimum && $count > $baseline * $fraction);
    }

    /** @param list<array<string, mixed>> $rows */
    private function hasLargeMovement(array $rows, int $metres): bool
    {
        $geometries = [];
        foreach ($rows as $row) {
            if ($row['before'] !== null && $row['after'] !== null && $row['before']['geometry'] !== $row['after']['geometry']) {
                $geometries[] = ['before' => $row['before']['geometry'], 'after' => $row['after']['geometry']];
            }
        }
        if ($geometries === []) {
            return false;
        }
        $result = DB::selectOne(<<<'SQL'
            SELECT EXISTS (
                SELECT 1 FROM jsonb_to_recordset(?::jsonb) AS r(before jsonb, after jsonb)
                WHERE ST_Distance(
                    ST_Centroid(ST_MakeValid(ST_GeomFromGeoJSON(r.before)))::geography,
                    ST_Centroid(ST_MakeValid(ST_GeomFromGeoJSON(r.after)))::geography
                ) > ?
            ) AS moved
            SQL, [json_encode($geometries, JSON_THROW_ON_ERROR), $metres]);

        return (bool) $result->moved;
    }

    /**
     * Missing records remain visible. Only accepted deliveries count toward a removal review.
     *
     * @param  list<array<string, mixed>>  $rows
     * @param  array<string, int|float>  $limits
     */
    private function hasPersistentMissing(DatasetImport $import, DatasetSource $source, array $rows, array $limits, ?DatasetImport $reference): bool
    {
        $missing = [];
        foreach ($rows as $row) {
            if ($row['status'] === 'missing') {
                $missing[$row['current']['id']] = ['count' => 1, 'since' => $import->retrieved_at];
            }
        }
        if ($missing === []) {
            return false;
        }
        $acknowledged = array_intersect(array_keys($missing), $reference?->publication_checks['acknowledged_missing_ids'] ?? []);
        if ($acknowledged !== []) {
            $model = $source->target_type === 'offstreet' ? new ParkingOffstreet : new ParkingMunicipal;
            $table = $model->getTable();
            $alreadyReviewed = $model->newQuery()->whereIn($table.'.id', $acknowledged)
                ->join('dataset_imports as last_seen', 'last_seen.id', '=', $table.'.published_import_id')
                ->where('last_seen.retrieved_at', '<=', $reference->retrieved_at)->pluck($table.'.id');
            foreach ($alreadyReviewed as $id) {
                unset($missing[$id]);
            }
            if ($missing === []) {
                return false;
            }
        }
        $history = DatasetImport::where('dataset_source_id', $source->id)->where('state', 'published')
            ->where('retrieved_at', '<', $import->retrieved_at)->latest('retrieved_at')
            ->select('retrieved_at')->selectRaw('identity_resolution IS NOT NULL AS has_resolution')
            ->selectRaw(<<<'SQL'
                (SELECT COALESCE(jsonb_agg(claim->>'facility_id'), '[]'::jsonb)
                 FROM jsonb_array_elements(COALESCE(identity_resolution, '[]'::jsonb)) AS claim
                 WHERE claim->>'facility_id' IN (SELECT jsonb_array_elements_text(?::jsonb))) AS seen_missing_ids
                SQL, [json_encode(array_keys($missing), JSON_THROW_ON_ERROR)])
            ->cursor();
        foreach ($history as $published) {
            if (! $published->has_resolution) {
                break;
            }
            $seen = array_fill_keys(json_decode($published->seen_missing_ids, true, flags: JSON_THROW_ON_ERROR), true);
            foreach ($missing as $id => &$absence) {
                if (isset($seen[$id])) {
                    unset($missing[$id]);

                    continue;
                }
                $absence['count']++;
                $absence['since'] = $published->retrieved_at;
                if ($absence['count'] >= $limits['missing_deliveries'] && $absence['since']->lte($import->retrieved_at->subDays($limits['missing_days']))) {
                    return true;
                }
            }
            unset($absence);
            if ($missing === []) {
                break;
            }
        }

        return false;
    }
}
