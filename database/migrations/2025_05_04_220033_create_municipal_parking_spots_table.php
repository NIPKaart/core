<?php

use App\Enums\ParkingOrientation;
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
        Schema::create('municipal_parking_spots', function (Blueprint $table) {
            $table->string('id')->primary(); // External ID as string
            $table->string('municipality');
            $table->integer('number');

            $table->foreignId('country_id')->constrained('countries');
            $table->foreignId('province_id')->constrained('provinces');

            $table->string('street')->nullable();
            $table->enum('orientation', ParkingOrientation::all())->nullable();

            // Parking details
            $table->decimal('longitude', 10, 7);
            $table->decimal('latitude', 10, 7);
            $table->boolean('visibility');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('municipal_parking_spots');
    }
};
