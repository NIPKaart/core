<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // These constraints validate existing rows and fail atomically on conflicts.
        // Never choose a winning rule or rewrite geographic ownership implicitly.
        DB::statement('ALTER TABLE public.parking_rules ADD CONSTRAINT parking_rules_scope_check CHECK (nationwide = (municipality_id IS NULL))');
        DB::statement('CREATE UNIQUE INDEX parking_rules_national_country_unique ON public.parking_rules (country_id) WHERE municipality_id IS NULL');

        DB::statement('ALTER TABLE public.provinces ADD CONSTRAINT provinces_id_country_unique UNIQUE (id, country_id)');
        DB::statement('ALTER TABLE public.municipalities ADD CONSTRAINT municipalities_province_country_foreign FOREIGN KEY (province_id, country_id) REFERENCES public.provinces (id, country_id)');
        DB::statement('ALTER TABLE public.municipalities ADD CONSTRAINT municipalities_id_country_unique UNIQUE (id, country_id)');
        DB::statement('ALTER TABLE public.municipalities ADD CONSTRAINT municipalities_id_province_country_unique UNIQUE (id, province_id, country_id)');

        foreach (['parking_spaces', 'parking_municipal_spaces', 'parking_offstreet_spaces'] as $table) {
            DB::statement("ALTER TABLE public.{$table} ADD CONSTRAINT {$table}_geography_foreign FOREIGN KEY (municipality_id, province_id, country_id) REFERENCES public.municipalities (id, province_id, country_id)");
        }

        DB::statement('ALTER TABLE public.parking_rules ADD CONSTRAINT parking_rules_municipality_country_foreign FOREIGN KEY (municipality_id, country_id) REFERENCES public.municipalities (id, country_id)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE public.parking_rules DROP CONSTRAINT parking_rules_municipality_country_foreign');
        foreach (['parking_spaces', 'parking_municipal_spaces', 'parking_offstreet_spaces'] as $table) {
            DB::statement("ALTER TABLE public.{$table} DROP CONSTRAINT {$table}_geography_foreign");
        }
        DB::statement('ALTER TABLE public.municipalities DROP CONSTRAINT municipalities_id_province_country_unique');
        DB::statement('ALTER TABLE public.municipalities DROP CONSTRAINT municipalities_id_country_unique');
        DB::statement('ALTER TABLE public.municipalities DROP CONSTRAINT municipalities_province_country_foreign');
        DB::statement('ALTER TABLE public.provinces DROP CONSTRAINT provinces_id_country_unique');
        DB::statement('DROP INDEX public.parking_rules_national_country_unique');
        DB::statement('ALTER TABLE public.parking_rules DROP CONSTRAINT parking_rules_scope_check');
    }
};
