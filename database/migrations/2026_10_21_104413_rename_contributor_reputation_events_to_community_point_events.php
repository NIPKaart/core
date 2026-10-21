<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('contributor_reputation_events', 'community_point_events');
    }

    public function down(): void
    {
        Schema::rename('community_point_events', 'contributor_reputation_events');
    }
};
