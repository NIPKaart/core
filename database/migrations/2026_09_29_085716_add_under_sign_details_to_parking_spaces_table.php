<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Replace the window_times flag with an explicit under-sign answer and optional structured restriction.
     *
     * Places with a parking duration or window times had a sub-sign; all others stay unknown (null), never no,
     * because the old form never asked about a sub-sign.
     */
    public function up(): void
    {
        Schema::table('parking_spaces', function (Blueprint $table) {
            $table->string('under_sign')->nullable()->after('orientation');
            $table->string('under_sign_text', 255)->nullable()->after('under_sign');
            $table->json('restriction_days')->nullable()->after('parking_disc');
            $table->time('restriction_starts_at')->nullable()->after('restriction_days');
            $table->time('restriction_ends_at')->nullable()->after('restriction_starts_at');
        });

        DB::table('parking_spaces')
            ->where(fn ($query) => $query->where('window_times', true)->orWhere('parking_time', '>', 0))
            ->update(['under_sign' => 'yes']);

        Schema::table('parking_spaces', function (Blueprint $table) {
            $table->dropColumn('window_times');
        });
    }

    /**
     * Reverse the migrations; window times are restored only where a structured restriction exists.
     */
    public function down(): void
    {
        Schema::table('parking_spaces', function (Blueprint $table) {
            $table->boolean('window_times')->default(false);
        });

        DB::table('parking_spaces')->whereNotNull('restriction_starts_at')->update(['window_times' => true]);

        Schema::table('parking_spaces', function (Blueprint $table) {
            $table->dropColumn(['under_sign', 'under_sign_text', 'restriction_days', 'restriction_starts_at', 'restriction_ends_at']);
        });
    }
};
