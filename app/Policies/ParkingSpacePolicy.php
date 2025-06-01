<?php

namespace App\Policies;

use App\Models\ParkingSpace;
use App\Models\User;

class ParkingSpacePolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('parking-space.view_any');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, ParkingSpace $parkingSpace): bool
    {
        return $user->can('parking-space.view');
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->can('parking-space.create');
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, ParkingSpace $parkingSpace): bool
    {
        return $user->can('parking-space.update');
    }

    /**
     * Determine whether the user can bulk update models.
     */
    public function bulkUpdate(User $user): bool
    {
        return $user->can('parking-space.update');
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, ParkingSpace $parkingSpace): bool
    {
        return $user->can('parking-space.delete');
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function trash(User $user): bool
    {
        return $user->can('parking-space.restore');
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, string $class): bool
    {
        return $user->can('parking-space.restore');
    }

    /**
     * Determine wether the user can bulk restore models.
     */
    public function bulkRestore(User $user): bool
    {
        return $user->can('parking-space.restore');
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, string $class): bool
    {
        return $user->can('parking-space.force-delete');
    }

    /**
     * Determine whether the user can bulk permanently delete models.
     */
    public function bulkForceDelete(User $user): bool
    {
        return $user->can('parking-space.force-delete');
    }
}
