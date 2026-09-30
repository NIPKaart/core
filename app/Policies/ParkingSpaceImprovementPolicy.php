<?php

namespace App\Policies;

use App\Models\User;

class ParkingSpaceImprovementPolicy
{
    /**
     * Determine whether the user can see the improvements awaiting review.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('parking-space-improvement.view_any');
    }

    /**
     * Determine whether the user can correct, approve or reject a proposed improvement.
     */
    public function review(User $user): bool
    {
        return $user->can('parking-space-improvement.review');
    }
}
