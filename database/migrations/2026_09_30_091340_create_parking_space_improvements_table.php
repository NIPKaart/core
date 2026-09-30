<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A signed-in user's proposed improvement to a published community parking space, and the moderator's decision.
     *
     * The public space stays as it is while the proposal is pending. `submitted` keeps the changes the user proposed;
     * on approval `approved` keeps the changes the moderator applied, possibly corrected, and `previous` the values they
     * replaced. A user has one pending proposal per space.
     */
    public function up(): void
    {
        Schema::create('parking_space_improvements', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('parking_space_id')->constrained('parking_spaces')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status')->default('pending');
            $table->jsonb('submitted');
            $table->jsonb('approved')->nullable();
            $table->jsonb('previous')->nullable();
            $table->string('reason')->nullable();
            $table->string('note', 1000)->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index('parking_space_id');
        });

        DB::statement("CREATE UNIQUE INDEX parking_space_improvements_pending_user_unique ON public.parking_space_improvements (parking_space_id, user_id) WHERE status = 'pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parking_space_improvements');
    }
};
