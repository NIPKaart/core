<?php

use App\Enums\ApiState;
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
        Schema::create('parking_offstreet_spaces', function (Blueprint $table) {
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
            $table->enum('parking_type', ['garage', 'parkandride']);
            $table->json('prices')->nullable();
            $table->string('url')->nullable();

            // Parking location
            $table->decimal('longitude', 10, 7);
            $table->decimal('latitude', 10, 7);

            // Existing API/import coordinates remain the only writable location.
            $table->geography('location', subtype: 'point', srid: 4326)
                ->storedAs('ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography');
            $table->spatialIndex('location', 'parking_offstreet_spaces_location_gist');
            $table->spatialIndex([DB::raw('(location::geometry)')], 'parking_offstreet_spaces_viewport_gist');

            $table->enum('api_state', ApiState::all())->nullable();
            $table->boolean('visibility');
            $table->timestamps();

            // Indexes
            $table->index('municipality_id');
        });

        DB::statement('ALTER TABLE parking_offstreet_spaces ADD CONSTRAINT parking_offstreet_spaces_coordinates_check CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parking_offstreet_spaces');
    }
};
