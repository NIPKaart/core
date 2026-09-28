<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\DatasetSource;
use App\Models\User;

class DatasetSourcePolicy
{
    /** Approving a source accepts its licence and terms, so only administrators decide. */
    public function approve(User $user, DatasetSource $datasetSource): bool
    {
        return $user->hasRole(UserRole::ADMIN);
    }
}
