<?php

namespace App\Policies;

use App\Models\ParkingOffstreet;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ParkingOffstreetPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('parking-offstreet.view_any');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, ParkingOffstreet $parkingOffstreet): bool
    {
        return $user->hasPermissionTo('parking-offstreet.view');
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->hasPermissionTo('parking-offstreet.create');
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, ParkingOffstreet $parkingOffstreet): bool
    {
        return $user->hasPermissionTo('parking-offstreet.update');
    }

    /**
     * Determine whether the user can bulk update models.
     */
    public function bulkUpdate(User $user): bool
    {
        return $user->hasPermissionTo('parking-offstreet.update');
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, ParkingOffstreet $parkingOffstreet): bool
    {
        return $user->hasPermissionTo('parking-offstreet.delete');
    }

    /**
     * Determine whether the user can toggle the visibility of the model.
     */
    public function toggleVisibility(User $user, ParkingOffstreet $parkingOffstreet): bool
    {
        return $user->hasPermissionTo('parking-offstreet.update');
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, ParkingOffstreet $parkingOffstreet): bool
    {
        return false;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, ParkingOffstreet $parkingOffstreet): bool
    {
        return false;
    }
}
