<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Area pages (#1307) address provinces and municipalities by a stable slug within their country, so their URLs do not
 * depend on a database identifier or on a translated display name.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['provinces', 'municipalities'] as $table) {
            Schema::table($table, function (Blueprint $table): void {
                $table->string('slug')->nullable();
            });

            $taken = [];
            DB::table($table)->orderBy('id')->select(['id', 'country_id', 'name'])->each(function (object $area) use ($table, &$taken): void {
                $base = Str::slug($area->name) ?: 'area';
                $slug = $base;
                for ($suffix = 2; isset($taken[$area->country_id][$slug]); $suffix++) {
                    $slug = $base.'-'.$suffix;
                }
                $taken[$area->country_id][$slug] = true;
                DB::table($table)->where('id', $area->id)->update(['slug' => $slug]);
            });

            Schema::table($table, function (Blueprint $table): void {
                $table->string('slug')->nullable(false)->change();
                $table->unique(['country_id', 'slug']);
            });
        }
    }

    public function down(): void
    {
        foreach (['provinces', 'municipalities'] as $table) {
            Schema::table($table, function (Blueprint $table): void {
                $table->dropUnique(['country_id', 'slug']);
                $table->dropColumn('slug');
            });
        }
    }
};
