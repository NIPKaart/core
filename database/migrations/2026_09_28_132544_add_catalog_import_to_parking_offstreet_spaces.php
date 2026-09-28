<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Catalog deliveries identify facilities by source and keep unknown capacity and live values unknown.
     */
    public function up(): void
    {
        Schema::table('parking_offstreet_spaces', function (Blueprint $table) {
            $table->integer('short_capacity')->nullable()->change();
            $table->integer('free_space_short')->nullable()->change();
            $table->integer('accessible_capacity')->nullable();
            $table->foreignId('dataset_source_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('external_id')->nullable();
            $table->jsonb('source_record')->nullable();
            $table->jsonb('last_imported_values')->nullable();
            $table->timestampTz('last_checked_at')->nullable();
            $table->foreignId('published_import_id')->nullable()->constrained('dataset_imports')->restrictOnDelete();
            $table->unique(['dataset_source_id', 'external_id']);
        });
    }

    public function down(): void
    {
        Schema::table('parking_offstreet_spaces', function (Blueprint $table) {
            $table->dropUnique(['dataset_source_id', 'external_id']);
            $table->dropConstrainedForeignId('published_import_id');
            $table->dropConstrainedForeignId('dataset_source_id');
            $table->dropColumn(['accessible_capacity', 'external_id', 'source_record', 'last_imported_values', 'last_checked_at']);
        });
        // Nullable capacity remains: restoring NOT NULL would lose unknown values.
    }
};
