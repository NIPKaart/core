<?php

namespace App\Policies;

use App\Models\ParkingMunicipal;
use App\Models\User;

class ParkingMunicipalPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('parking-municipal.view_any');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, ParkingMunicipal $parkingMunicipal): bool
    {
        return $user->hasPermissionTo('parking-municipal.view');
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->hasPermissionTo('parking-municipal.create');
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, ParkingMunicipal $parkingMunicipal): bool
    {
        return $user->hasPermissionTo('parking-municipal.update');
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, ParkingMunicipal $parkingMunicipal): bool
    {
        return $user->hasPermissionTo('parking-municipal.delete');
    }

    /**
     * Determine whether the user can toggle the visibility of the model.
     */
    public function toggleVisibility(User $user, ParkingMunicipal $parkingMunicipal): bool
    {
        return $user->hasPermissionTo('parking-municipal.update');
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, ParkingMunicipal $parkingMunicipal): bool
    {
        return false;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, ParkingMunicipal $parkingMunicipal): bool
    {
        return false;
    }
}
