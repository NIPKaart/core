<?php

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
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
        Schema::create('parking_spaces', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->enum('status', ParkingStatus::all())->default(ParkingStatus::PENDING->value);
            $table->ipAddress('ip_address')->nullable();

            $table->foreignId('country_id')->constrained('countries');
            $table->foreignId('province_id')->constrained('provinces');
            $table->foreignId('municipality_id')->constrained('municipalities');

            // Parking spaces details
            $table->string('city');
            $table->string('suburb')->nullable();
            $table->string('neighbourhood')->nullable();
            $table->string('postcode');
            $table->string('street');
            $table->string('amenity')->nullable();

            // Parking space location
            $table->decimal('longitude', 10, 7);
            $table->decimal('latitude', 10, 7);

            // Parking space availability
            $table->bigInteger('parking_time')->nullable();
            $table->enum('orientation', ParkingOrientation::all());
            $table->boolean('parking_disc')->default(false);
            $table->boolean('window_times')->default(false);
            $table->text('description')->nullable();

            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parking_spaces');
    }
};
