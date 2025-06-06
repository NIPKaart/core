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
        Schema::create('parking_municipal', function (Blueprint $table) {
            $table->string('id')->primary(); // External ID as string
            $table->foreignId('country_id')->constrained('countries');
            $table->foreignId('province_id')->constrained('provinces');
            $table->foreignId('municipality_id')->constrained('municipalities');

            $table->integer('number');
            $table->string('street')->nullable();
            $table->enum('orientation', ParkingOrientation::all())->nullable();

            // Parking details
            $table->decimal('longitude', 10, 7);
            $table->decimal('latitude', 10, 7);
            $table->boolean('visibility')->default(true);
            $table->timestamps();

            // Indexes
            $table->index('municipality_id');
            $table->index('visibility');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parking_municipal');
    }
};
