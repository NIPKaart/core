<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contributor_reputation_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('kind');
            $table->string('subject_id');
            $table->string('outcome');
            $table->string('reason')->nullable();
            $table->timestamp('decided_at');
            $table->timestamp('recorded_at');
            $table->unique(['kind', 'subject_id']);
            $table->index(['user_id', 'decided_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contributor_reputation_events');
    }
};
