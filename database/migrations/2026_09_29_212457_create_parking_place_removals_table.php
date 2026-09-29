<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * An attributable record of a moderator removing a community place or hiding a municipal one.
     *
     * The removed community place itself is deleted, so this record keeps only its identity and label, not its data.
     */
    public function up(): void
    {
        Schema::create('parking_place_removals', function (Blueprint $table) {
            $table->id();
            $table->string('source');
            $table->string('place_id');
            $table->string('place_label')->nullable();
            $table->string('action');
            $table->string('reason');
            $table->string('note', 1000)->nullable();
            $table->unsignedInteger('open_reports');
            $table->foreignId('removed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('removed_at');

            $table->index(['source', 'place_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parking_place_removals');
    }
};
