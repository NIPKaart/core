<?php

use App\Enums\ParkingOrientation;
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
        Schema::create('parking_municipal_spaces', function (Blueprint $table) {
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

            // Existing API/import coordinates remain the only writable location.
            $table->geography('location', subtype: 'point', srid: 4326)
                ->storedAs('ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography');
            $table->spatialIndex('location', 'parking_municipal_spaces_location_gist');
            $table->spatialIndex([DB::raw('(location::geometry)')], 'parking_municipal_spaces_viewport_gist');
            $table->boolean('visibility')->default(true);
            $table->timestamps();

            // Indexes
            $table->index('municipality_id');
            $table->index('visibility');
        });

        DB::statement('ALTER TABLE parking_municipal_spaces ADD CONSTRAINT parking_municipal_spaces_coordinates_check CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parking_municipal_spaces');
    }
};
