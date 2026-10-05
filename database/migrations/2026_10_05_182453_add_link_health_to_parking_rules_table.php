<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Whether each official rule link still opens: when it was last checked, how that went and since when it fails.
     */
    public function up(): void
    {
        Schema::table('parking_rules', function (Blueprint $table) {
            $table->string('link_status', 16)->nullable()->after('nationwide');
            $table->unsignedSmallInteger('link_http_status')->nullable()->after('link_status');
            $table->string('link_error', 255)->nullable()->after('link_http_status');
            $table->string('link_final_url', 2048)->nullable()->after('link_error');
            $table->timestamp('link_checked_at')->nullable()->after('link_final_url');
            $table->timestamp('link_failing_since')->nullable()->after('link_checked_at');
        });
    }

    public function down(): void
    {
        Schema::table('parking_rules', function (Blueprint $table) {
            $table->dropColumn(['link_status', 'link_http_status', 'link_error', 'link_final_url', 'link_checked_at', 'link_failing_since']);
        });
    }
};
