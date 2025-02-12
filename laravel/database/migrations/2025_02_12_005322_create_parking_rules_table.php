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
        Schema::create('parking_rules', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('country_id')->constrained('countries');
            $table->string('municipality');
            $table->string('url');
            $table->boolean('nationwide');
            $table->timestamps();

            $table->unique(['country_id', 'municipality']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parking_rules');
    }
};
