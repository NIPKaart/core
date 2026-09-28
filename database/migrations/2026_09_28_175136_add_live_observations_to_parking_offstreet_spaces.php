<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Capacity, free spaces and the operator status are observations: they change during the day and are stored as the
     * latest measurement per facility. Long-stay values (season tickets) and accessible
     * counts are dropped: the first say nothing to visitors, the second are almost never published.
     */
    public function up(): void
    {
        Schema::table('parking_offstreet_spaces', function (Blueprint $table) {
            $table->renameColumn('short_capacity', 'capacity');
            $table->renameColumn('free_space_short', 'free_space');
            $table->dropColumn(['long_capacity', 'free_space_long', 'accessible_capacity']);
        });
        Schema::table('parking_offstreet_spaces', function (Blueprint $table) {
            $table->string('occupancy_status')->nullable();
            $table->timestampTz('observed_at')->nullable();
            $table->timestampTz('observation_fetched_at')->nullable();
        });
        Schema::table('dataset_sources', function (Blueprint $table) {
            $table->string('last_observation_key')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('dataset_sources', function (Blueprint $table) {
            $table->dropColumn('last_observation_key');
        });
        Schema::table('parking_offstreet_spaces', function (Blueprint $table) {
            $table->dropColumn(['occupancy_status', 'observed_at', 'observation_fetched_at']);
            $table->renameColumn('capacity', 'short_capacity');
            $table->renameColumn('free_space', 'free_space_short');
            $table->integer('long_capacity')->nullable();
            $table->integer('free_space_long')->nullable();
            $table->integer('accessible_capacity')->nullable();
        });
    }
};
