<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\MunicipalImport;
use App\Models\User;

class MunicipalImportPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(UserRole::ADMIN);
    }

    public function view(User $user, MunicipalImport $municipalImport): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function update(User $user, MunicipalImport $municipalImport): bool
    {
        return $this->viewAny($user);
    }
}
