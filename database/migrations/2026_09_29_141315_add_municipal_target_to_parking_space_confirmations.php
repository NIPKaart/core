<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Let a confirmation target either a community or a municipal parking place, never both or neither.
     *
     * Each target keeps its own foreign key, so removing a place still removes its confirmations.
     */
    public function up(): void
    {
        Schema::table('parking_space_confirmations', function (Blueprint $table) {
            $table->uuid('parking_space_id')->nullable()->change();
            $table->string('parking_municipal_id')->nullable()->after('parking_space_id');
            $table->foreign('parking_municipal_id')->references('id')->on('parking_municipal_spaces')->cascadeOnDelete();
            $table->index(['parking_municipal_id', 'user_id', 'confirmed_at'], 'ps_conf_municipal_user_time_idx');
        });

        DB::statement('ALTER TABLE public.parking_space_confirmations ADD CONSTRAINT parking_space_confirmations_one_target_check CHECK (num_nonnulls(parking_space_id, parking_municipal_id) = 1)');
    }

    /**
     * Reverse the migrations; confirmations of municipal places cannot be kept without their target.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE public.parking_space_confirmations DROP CONSTRAINT parking_space_confirmations_one_target_check');
        DB::table('parking_space_confirmations')->whereNull('parking_space_id')->delete();

        Schema::table('parking_space_confirmations', function (Blueprint $table) {
            $table->dropForeign(['parking_municipal_id']);
            $table->dropIndex('ps_conf_municipal_user_time_idx');
            $table->dropColumn('parking_municipal_id');
            $table->uuid('parking_space_id')->nullable(false)->change();
        });
    }
};
