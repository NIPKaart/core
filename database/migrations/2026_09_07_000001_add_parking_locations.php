<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private array $tables = ['parking_spaces', 'parking_municipal_spaces', 'parking_offstreet_spaces'];

    public function up(): void
    {
        foreach ($this->tables as $table) {
            // Scalars remain the sole writable coordinates during the API/import transition.
            DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$table}_coordinates_check CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)");
            DB::statement("ALTER TABLE {$table} ADD COLUMN location geography(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography) STORED");
            DB::statement("CREATE INDEX {$table}_location_gist ON {$table} USING gist (location)");
            DB::statement("CREATE INDEX {$table}_viewport_gist ON {$table} USING gist ((location::geometry))");
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $table) {
            DB::statement("ALTER TABLE {$table} DROP COLUMN location");
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT {$table}_coordinates_check");
        }
    }
};
