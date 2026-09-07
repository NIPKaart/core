<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public');
    }

    public function down(): void
    {
        // PostGIS is database infrastructure; rolling back application tables must
        // not remove extension objects or spatial data belonging to other users.
    }
};
