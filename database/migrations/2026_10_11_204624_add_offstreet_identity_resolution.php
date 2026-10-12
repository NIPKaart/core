<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('dataset_imports', function (Blueprint $table) {
            $table->jsonb('identity_decisions')->nullable();
            $table->jsonb('identity_resolution')->nullable();
        });
        Schema::table('dataset_sources', function (Blueprint $table) {
            $table->boolean('requires_identity_context')->default(false);
        });
        Schema::table('parking_offstreet_spaces', function (Blueprint $table) {
            $table->jsonb('observation_identity')->nullable();
            $table->timestampTz('missing_since')->nullable();
            $table->unsignedInteger('consecutive_missing_deliveries')->default(0);
            $table->dropUnique(['dataset_source_id', 'external_id']);
            $table->index(['dataset_source_id', 'external_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Forward-fix after publication: source IDs may now have been reused for different facilities.
        Schema::table('parking_offstreet_spaces', function (Blueprint $table) {
            $table->unique(['dataset_source_id', 'external_id']);
            $table->dropIndex(['dataset_source_id', 'external_id']);
            $table->dropColumn(['missing_since', 'consecutive_missing_deliveries', 'observation_identity']);
        });
        Schema::table('dataset_sources', function (Blueprint $table) {
            $table->dropColumn('requires_identity_context');
        });
        Schema::table('dataset_imports', function (Blueprint $table) {
            $table->dropColumn(['identity_decisions', 'identity_resolution']);
        });
    }
};
