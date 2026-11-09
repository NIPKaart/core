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
        Schema::table('location_proposal_decisions', function (Blueprint $table) {
            $table->string('existing_parking_municipal_id')->nullable();
            $table->foreign('existing_parking_municipal_id', 'proposal_decisions_municipal_fk')
                ->references('id')->on('parking_municipal_spaces')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('location_proposal_decisions', function (Blueprint $table) {
            $table->dropForeign('proposal_decisions_municipal_fk');
            $table->dropColumn('existing_parking_municipal_id');
        });
    }
};
