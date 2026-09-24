<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('parking_municipal_spaces', function (Blueprint $table) {
            $table->foreignId('published_import_id')->nullable()->constrained('municipal_imports')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('parking_municipal_spaces', function (Blueprint $table) {
            $table->dropConstrainedForeignId('published_import_id');
        });
    }
};
