<?php

namespace App\Traits;

use Illuminate\Support\Str;

/**
 * A stable, readable address for a province or municipality within its country, used by the area pages (#1307).
 *
 * The slug is set once, when the area is created, so a later change of the display name keeps existing links working.
 */
trait HasAreaSlug
{
    protected static function bootHasAreaSlug(): void
    {
        static::creating(function (self $area): void {
            $area->slug ??= $area->uniqueAreaSlug();
        });
    }

    /**
     * The name as a slug, numbered when another area in the same country already uses it.
     */
    public function uniqueAreaSlug(): string
    {
        $base = Str::slug((string) $this->name) ?: 'area';
        $slug = $base;
        for ($suffix = 2; static::query()->where('country_id', $this->country_id)->where('slug', $slug)->exists(); $suffix++) {
            $slug = $base.'-'.$suffix;
        }

        return $slug;
    }
}
