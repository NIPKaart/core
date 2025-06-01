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
        Schema::create('parking_offstreets', function (Blueprint $table) {
            $table->string('id')->primary(); // External ID as primary key
            $table->string('name');

            $table->foreignId('country_id')->constrained('countries');
            $table->foreignId('province_id')->constrained('provinces');
            $table->foreignId('municipality_id')->constrained('municipalities');

            // Parking details
            $table->integer('free_space_short');
            $table->integer('free_space_long')->nullable();
            $table->integer('short_capacity');
            $table->integer('long_capacity')->nullable();
            $table->double('availability_pct')->nullable();
            $table->enum('parking_type', ['garage', 'parkandride']);
            $table->json('prices')->nullable();
            $table->string('url')->nullable();

            // Parking location
            $table->decimal('longitude', 10, 7);
            $table->decimal('latitude', 10, 7);

            $table->string('state')->nullable();
            $table->boolean('visibility');
            $table->timestamps();

            // Indexes
            $table->index('municipality');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parking_offstreets');
    }
};
