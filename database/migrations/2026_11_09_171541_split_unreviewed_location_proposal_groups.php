<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('dataset_sources')->where('target_type', 'proposals')->orderBy('id')->lockForUpdate()->get(['id']);

        DB::statement(<<<'SQL'
            WITH split AS (
                SELECT point.id, COALESCE(point.municipality_id, original.municipality_id) AS municipality_id
                FROM location_proposal_points AS point
                JOIN location_proposals AS original ON original.id = point.location_proposal_id
                WHERE point.id <> original.id
                    AND original.closed_at IS NULL AND original.bays_published_at IS NULL AND original.decision_revision = 0
                    AND NOT EXISTS (
                        SELECT 1 FROM location_proposal_points AS occupant
                        WHERE occupant.location_proposal_id = point.id
                    )
            ), individual AS (
                INSERT INTO location_proposals (id, municipality_id, created_at)
                SELECT id, municipality_id, CURRENT_TIMESTAMP FROM split
                ON CONFLICT (id) DO UPDATE SET municipality_id = EXCLUDED.municipality_id
                WHERE location_proposals.closed_at IS NULL AND location_proposals.bays_published_at IS NULL
                    AND location_proposals.decision_revision = 0
                RETURNING id
            )
            UPDATE location_proposal_points AS point SET location_proposal_id = individual.id
            FROM individual WHERE point.id = individual.id
            SQL);
    }

    public function down(): void
    {
        // Former group membership cannot be restored safely after further moderation.
    }
};
