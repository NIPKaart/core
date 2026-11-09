<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('location_proposals', function (Blueprint $table) {
            $table->timestampTz('bays_published_at')->nullable();
        });

        Schema::table('parking_spaces', function (Blueprint $table) {
            $table->foreignId('location_proposal_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('location_proposal_point_id')->nullable()->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('location_proposal_bay_number')->nullable();
            $table->index('location_proposal_id');
        });
    }

    public function down(): void
    {
        Schema::table('parking_spaces', function (Blueprint $table) {
            $table->dropIndex(['location_proposal_id']);
            $table->dropColumn('location_proposal_bay_number');
            $table->dropConstrainedForeignId('location_proposal_point_id');
            $table->dropConstrainedForeignId('location_proposal_id');
        });

        Schema::table('location_proposals', fn (Blueprint $table) => $table->dropColumn('bays_published_at'));
    }
};
