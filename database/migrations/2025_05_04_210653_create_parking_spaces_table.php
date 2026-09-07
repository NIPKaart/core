<?php

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public');

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

            // Existing API/import coordinates remain the only writable location.
            $table->geography('location', subtype: 'point', srid: 4326)
                ->storedAs('ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography');
            $table->spatialIndex('location', 'parking_spaces_location_gist');
            $table->spatialIndex([DB::raw('(location::geometry)')], 'parking_spaces_viewport_gist');

            // Parking space availability
            $table->bigInteger('parking_time')->nullable();
            $table->enum('orientation', ParkingOrientation::all());
            $table->boolean('parking_disc')->default(false);
            $table->boolean('window_times')->default(false);
            $table->text('description')->nullable();

            $table->softDeletes();
            $table->timestamps();
        });

        DB::statement('ALTER TABLE parking_spaces ADD CONSTRAINT parking_spaces_coordinates_check CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parking_spaces');
    }
};
