<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public');
    }

    public function down(): void
    {
        // Shared extensions are retained, like PostGIS, when rolling back application migrations.
    }
};
