<?php

namespace App\Policies;

use App\Models\ParkingSpot;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ParkingSpotPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('view_any_parking::spot');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, ParkingSpot $parkingSpot): bool
    {
        return $user->can('view_parking::spot');
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->can('create_parking::spot');
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, ParkingSpot $parkingSpot): bool
    {
        return $user->can('update_parking::spot');
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, ParkingSpot $parkingSpot): bool
    {
        return $user->can('delete_parking::spot');
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, ParkingSpot $parkingSpot): bool
    {
        return $user->can('restore_parking::spot');
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, ParkingSpot $parkingSpot): bool
    {
        return $user->can('force_delete_parking::spot');
    }
}
