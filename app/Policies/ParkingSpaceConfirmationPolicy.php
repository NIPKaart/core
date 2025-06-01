<?php

namespace App\Policies;

use App\Models\ParkingSpaceConfirmation;
use App\Models\User;

class ParkingSpaceConfirmationPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('parking-space-confirmation.view_any');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, ParkingSpaceConfirmation $parkingSpaceConfirmation): bool
    {
        return $user->can('parking-space-confirmation.view');
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, ParkingSpaceConfirmation $parkingSpaceConfirmation): bool
    {
        return $user->can('parking-space-confirmation.delete');
    }

    /**
     * Determine whether the user can delete multiple models.
     */
    public function bulkDelete(User $user): bool
    {
        return $user->can('parking-space-confirmation.delete');
    }
}
