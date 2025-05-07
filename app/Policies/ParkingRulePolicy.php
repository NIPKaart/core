<?php

namespace App\Policies;

use App\Models\ParkingRule;
use App\Models\User;

class ParkingRulePolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('parking-rule.view_any');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, ParkingRule $parkingRule): bool
    {
        return $user->can('parking-rule.view');
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->can('parking-rule.create');
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, ParkingRule $parkingRule): bool
    {
        return $user->can('parking-rule.update');
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, ParkingRule $parkingRule): bool
    {
        return $user->can('parking-rule.delete');
    }

    /**
     * Determine whether the user can restore the model.
     */
    // public function restore(User $user, ParkingRule $parkingRule): bool
    // {
    //     return false;
    // }

    /**
     * Determine whether the user can permanently delete the model.
     */
    // public function forceDelete(User $user, ParkingRule $parkingRule): bool
    // {
    //     return false;
    // }
}
