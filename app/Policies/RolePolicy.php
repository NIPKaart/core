<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\User;

class RolePolicy
{
    /**
     * Determine whether the user can view the read-only roles and permissions overview.
     *
     * Roles are declared in code, so there are no create, update or delete abilities.
     */
    public function viewAny(User $user): bool
    {
        return $user->can(Permission::ROLE_VIEW_ANY->value);
    }
}
