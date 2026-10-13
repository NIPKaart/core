<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE parking_offstreet_spaces DROP CONSTRAINT parking_offstreet_spaces_parking_type_check');
        DB::statement("ALTER TABLE parking_offstreet_spaces ADD CONSTRAINT parking_offstreet_spaces_parking_type_check CHECK (parking_type IN ('garage', 'parkandride', 'parking_lot'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE parking_offstreet_spaces DROP CONSTRAINT parking_offstreet_spaces_parking_type_check');
        DB::statement("ALTER TABLE parking_offstreet_spaces ADD CONSTRAINT parking_offstreet_spaces_parking_type_check CHECK (parking_type IN ('garage', 'parkandride'))");
    }
};
