<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Catalog deliveries identify facilities by source; capacity and occupancy arrive as observations (#1221).
     */
    public function up(): void
    {
        Schema::table('parking_offstreet_spaces', function (Blueprint $table) {
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
            $table->dropColumn(['external_id', 'source_record', 'last_imported_values', 'last_checked_at']);
        });
    }
};
