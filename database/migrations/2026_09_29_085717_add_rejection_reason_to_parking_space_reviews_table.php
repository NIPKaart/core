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
        Schema::table('parking_space_reviews', function (Blueprint $table) {
            $table->string('reason')->nullable()->after('to_status');
            $table->string('note', 1000)->nullable()->after('reason');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('parking_space_reviews', function (Blueprint $table) {
            $table->dropColumn(['reason', 'note']);
        });
    }
};
