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
        Schema::create('location_proposal_match_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_proposal_point_id')->constrained()->cascadeOnDelete();
            $table->foreignId('moderator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('parking_source');
            $table->string('parking_id');
            $table->decimal('marker_distance_metres', 7, 2);
            $table->string('outcome');
            $table->timestampTz('reviewed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('location_proposal_match_reviews');
    }
};
