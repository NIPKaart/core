<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Live observations keep only the latest measurement per facility; accessible free spaces are stored separately and never derived.
     */
    public function up(): void
    {
        Schema::table('parking_offstreet_spaces', function (Blueprint $table) {
            $table->integer('free_space_accessible')->nullable();
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
            $table->dropColumn(['free_space_accessible', 'observed_at', 'observation_fetched_at']);
        });
    }
};
