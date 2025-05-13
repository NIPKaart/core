<?php

namespace App\Policies;

use App\Models\User;
use App\Models\UserParkingSpot;
use Illuminate\Auth\Access\Response;

class UserParkingSpotPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('user-parking-spot.view_any');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, UserParkingSpot $userParkingSpot): bool
    {
        return $user->can('user-parking-spot.view');
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->can('user-parking-spot.create');
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, UserParkingSpot $userParkingSpot): bool
    {
        return $user->can('user-parking-spot.update');
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, UserParkingSpot $userParkingSpot): bool
    {
        return $user->can('user-parking-spot.delete');
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, UserParkingSpot $userParkingSpot): bool
    {
        return $user->can('user-parking-spot.restore');
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, UserParkingSpot $userParkingSpot): bool
    {
        return $user->can('user-parking-spot.force-delete');
    }
}
