<?php

namespace App\Policies;

use App\Enums\ParkingStatus;
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
     * Determine whether the contributor can see the confirmation of their own submission.
     */
    public function viewSubmission(User $user, ParkingSpace $parkingSpace): bool
    {
        return $parkingSpace->user_id === $user->id;
    }

    /**
     * Determine whether the contributor can still change their own submission, which is only while it awaits moderation.
     */
    public function updateSubmission(User $user, ParkingSpace $parkingSpace): bool
    {
        return $parkingSpace->user_id === $user->id && $parkingSpace->status === ParkingStatus::PENDING;
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, ParkingSpace $parkingSpace): bool
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
    public function forceDelete(User $user, ParkingSpace $parkingSpace): bool
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
