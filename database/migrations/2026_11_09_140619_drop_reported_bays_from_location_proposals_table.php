<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * No proposal source reports a number of bays, so the column was never filled.
     */
    public function up(): void
    {
        Schema::table('location_proposals', function (Blueprint $table) {
            $table->dropColumn('reported_bays');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('location_proposals', function (Blueprint $table) {
            $table->unsignedSmallInteger('reported_bays')->nullable();
        });
    }
};
