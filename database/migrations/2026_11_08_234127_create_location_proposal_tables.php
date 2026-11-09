<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dataset_sources', function (Blueprint $table) {
            $table->timestampTz('last_proposal_retrieved_at', 6)->nullable();
            $table->unsignedInteger('last_proposal_source_count')->nullable();
        });

        Schema::table('dataset_deliveries', function (Blueprint $table) {
            $table->timestampTz('proposal_retrieved_at', 6)->nullable();
        });

        Schema::create('location_proposals', function (Blueprint $table) {
            $table->unsignedBigInteger('id')->primary();
            $table->foreignId('municipality_id')->constrained()->restrictOnDelete();
            $table->timestampTz('created_at');
            $table->index(['municipality_id', 'id']);
        });

        Schema::create('location_proposal_points', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dataset_source_id')->constrained()->restrictOnDelete();
            $table->uuid('external_id');
            $table->foreignId('location_proposal_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('municipality_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('municipality_code', 6)->nullable();
            $table->double('latitude');
            $table->double('longitude');
            $table->date('source_last_seen_on')->nullable();
            $table->jsonb('under_sign_types');
            $table->boolean('personal');
            $table->timestampTz('last_seen_at', 6);
            $table->timestampTz('missing_since', 6)->nullable();
            $table->unique(['dataset_source_id', 'external_id']);
            $table->index(['location_proposal_id', 'municipality_id']);
            $table->index(['municipality_id', 'dataset_source_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('location_proposal_points');
        Schema::dropIfExists('location_proposals');
        Schema::table('dataset_deliveries', fn (Blueprint $table) => $table->dropColumn('proposal_retrieved_at'));
        Schema::table('dataset_sources', fn (Blueprint $table) => $table->dropColumn(['last_proposal_retrieved_at', 'last_proposal_source_count']));
    }
};
