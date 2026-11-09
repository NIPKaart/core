<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('location_proposals', function (Blueprint $table) {
            $table->unsignedSmallInteger('reported_bays')->nullable();
            $table->timestampTz('closed_at')->nullable();
            $table->unsignedInteger('decision_revision')->default(0);
        });

        Schema::create('location_proposal_decisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_proposal_id')->constrained();
            $table->foreignId('moderator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('decided_at')->index();
            $table->string('outcome');
            $table->string('reason')->nullable();
            $table->string('note', 500)->nullable();
            $table->foreignUuid('existing_parking_space_id')->nullable()->constrained('parking_spaces')->nullOnDelete();
            $table->jsonb('evidence');
            $table->index(['location_proposal_id', 'id']);
        });

        DB::statement(<<<'SQL'
            INSERT INTO location_proposal_decisions (location_proposal_id, moderator_id, decided_at, outcome, evidence)
            SELECT proposal.id, bay.reviewed_by, proposal.bays_published_at, 'completed',
                jsonb_build_object(
                    'street', bay.street, 'municipality', municipality.name, 'source', source.name,
                    'last_seen_on', point.source_last_seen_on, 'orientation', bay.orientation,
                    'under_sign', bay.under_sign, 'restriction', bay.under_sign_text,
                    'parking_time', bay.parking_time, 'restriction_days', bay.restriction_days,
                    'restriction_starts_at', bay.restriction_starts_at, 'restriction_ends_at', bay.restriction_ends_at,
                    'bays', COALESCE(
                        (SELECT jsonb_agg(jsonb_build_object('id', space.id, 'number', space.location_proposal_bay_number)
                            ORDER BY space.location_proposal_bay_number)
                         FROM parking_spaces space WHERE space.location_proposal_id = proposal.id), '[]'::jsonb
                    )
                )
            FROM location_proposals proposal
            JOIN municipalities municipality ON municipality.id = proposal.municipality_id
            LEFT JOIN LATERAL (
                SELECT space.*, review.reviewed_by
                FROM parking_spaces space
                LEFT JOIN parking_space_reviews review ON review.parking_space_id = space.id
                    AND review.from_status IS NULL AND review.to_status = 'approved'
                    AND review.reviewed_at = proposal.bays_published_at AT TIME ZONE 'UTC'
                WHERE space.location_proposal_id = proposal.id
                ORDER BY (review.id IS NULL), space.location_proposal_bay_number, review.id
                LIMIT 1
            ) bay ON true
            LEFT JOIN location_proposal_points point ON point.id = bay.location_proposal_point_id
            LEFT JOIN dataset_sources source ON source.id = point.dataset_source_id
            WHERE proposal.bays_published_at IS NOT NULL
            SQL);

        DB::table('location_proposals')->whereNotNull('bays_published_at')
            ->update(['closed_at' => DB::raw('bays_published_at'), 'decision_revision' => 1]);
    }

    public function down(): void
    {
        Schema::dropIfExists('location_proposal_decisions');
        Schema::table('location_proposals', fn (Blueprint $table) => $table->dropColumn(['reported_bays', 'closed_at', 'decision_revision']));
    }
};
