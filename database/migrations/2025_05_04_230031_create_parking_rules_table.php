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
            $table->foreignId('municipality_id')->nullable()->constrained('municipalities');
            $table->string('url');
            $table->boolean('nationwide')->default(false);
            $table->timestamps();

            $table->unique(['country_id', 'municipality_id']);
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
