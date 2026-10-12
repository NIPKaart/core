<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('parking_municipal_spaces', function (Blueprint $table) {
            $table->dropUnique(['dataset_source_id', 'external_id']);
            $table->index(['dataset_source_id', 'external_id']);
        });
    }

    public function down(): void
    {
        Schema::table('parking_municipal_spaces', function (Blueprint $table) {
            $table->unique(['dataset_source_id', 'external_id']);
            $table->dropIndex(['dataset_source_id', 'external_id']);
        });
    }
};
