<?php

namespace App\Traits;

use App\Models\ParkingPlaceReport;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A parking place that signed-in users can report as no longer existing, whatever its source.
 */
trait Reportable
{
    public function reports(): HasMany
    {
        return $this->hasMany(ParkingPlaceReport::class);
    }

    public function isReportedBy(User $user): bool
    {
        return $this->reports()->open()->whereBelongsTo($user)->exists();
    }
}
