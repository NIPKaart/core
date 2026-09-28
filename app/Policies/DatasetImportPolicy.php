<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\DatasetImport;
use App\Models\User;

class DatasetImportPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(UserRole::ADMIN);
    }

    public function view(User $user, DatasetImport $datasetImport): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function update(User $user, DatasetImport $datasetImport): bool
    {
        return $this->viewAny($user);
    }
}
