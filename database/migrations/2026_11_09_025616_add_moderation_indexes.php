<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The moderation inbox reads two small, ordered slices of large tables: the items still open, oldest first, and the
 * decisions taken, newest first. Partial indexes keep both reads proportional to the slice instead of the table.
 */
return new class extends Migration
{
    private const array INDEXES = [
        "parking_spaces_pending_created_at ON public.parking_spaces (created_at) WHERE status = 'pending' AND deleted_at IS NULL",
        'parking_place_reports_open_created_at ON public.parking_place_reports (created_at) WHERE resolved_at IS NULL',
        "parking_space_reviews_decided_reviewed_at ON public.parking_space_reviews (reviewed_at) WHERE from_status = 'pending' AND to_status IN ('approved', 'rejected')",
        "parking_space_improvements_decided_reviewed_at ON public.parking_space_improvements (reviewed_at) WHERE status IN ('approved', 'rejected')",
        "parking_place_reports_kept_resolved_at ON public.parking_place_reports (resolved_at) WHERE resolution = 'kept'",
        'parking_place_removals_removed_at ON public.parking_place_removals (removed_at)',
    ];

    public function up(): void
    {
        foreach (self::INDEXES as $index) {
            DB::statement("CREATE INDEX {$index}");
        }
    }

    public function down(): void
    {
        foreach (self::INDEXES as $index) {
            DB::statement('DROP INDEX IF EXISTS public.'.strtok($index, ' '));
        }
    }
};
