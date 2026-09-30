<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A signed-in user's report that a community or municipal parking place no longer exists.
     *
     * Reports are moderation signals: they never change what the map shows. Each targets exactly one place through
     * its own foreign key, so removing the place removes its reports, and a user has at most one open report per place.
     */
    public function up(): void
    {
        Schema::create('parking_place_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('parking_space_id')->nullable()->constrained('parking_spaces')->cascadeOnDelete();
            $table->string('parking_municipal_id')->nullable();
            $table->foreign('parking_municipal_id')->references('id')->on('parking_municipal_spaces')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('reason')->nullable();
            $table->string('note', 500)->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('resolution')->nullable();
            $table->timestamps();

            $table->index(['parking_space_id', 'resolved_at']);
            $table->index(['parking_municipal_id', 'resolved_at']);
        });

        DB::statement('ALTER TABLE public.parking_place_reports ADD CONSTRAINT parking_place_reports_one_target_check CHECK (num_nonnulls(parking_space_id, parking_municipal_id) = 1)');
        DB::statement('CREATE UNIQUE INDEX parking_place_reports_open_space_user_unique ON public.parking_place_reports (parking_space_id, user_id) WHERE resolved_at IS NULL');
        DB::statement('CREATE UNIQUE INDEX parking_place_reports_open_municipal_user_unique ON public.parking_place_reports (parking_municipal_id, user_id) WHERE resolved_at IS NULL');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parking_place_reports');
    }
};
