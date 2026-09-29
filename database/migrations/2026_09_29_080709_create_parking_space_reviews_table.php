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
        Schema::create('parking_space_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('parking_space_id')->constrained('parking_spaces')->cascadeOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->timestamp('reviewed_at');
            $table->index(['parking_space_id', 'reviewed_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parking_space_reviews');
    }
};
