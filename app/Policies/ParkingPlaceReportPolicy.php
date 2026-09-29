<?php

namespace App\Policies;

use App\Models\User;

class ParkingPlaceReportPolicy
{
    /**
     * Determine whether the user can see the places reported as no longer existing.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('parking-place-report.view_any');
    }

    /**
     * Determine whether the user can keep a reported place, or delete a community place and hide a municipal one.
     */
    public function resolve(User $user): bool
    {
        return $user->can('parking-place-report.resolve');
    }
}
