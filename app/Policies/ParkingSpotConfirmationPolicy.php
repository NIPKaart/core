<?php

namespace App\Policies;

use App\Models\ParkingSpotConfirmation;
use App\Models\User;

class ParkingSpotConfirmationPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('parking-spot-confirmation.view_any');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, ParkingSpotConfirmation $parkingSpotConfirmation): bool
    {
        return $user->can('parking-spot-confirmation.view');
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, ParkingSpotConfirmation $parkingSpotConfirmation): bool
    {
        return $user->can('parking-spot-confirmation.delete');
    }

    /**
     * Determine whether the user can delete multiple models.
     */
    public function bulkDelete(User $user): bool
    {
        return $user->can('parking-spot-confirmation.delete');
    }
}
