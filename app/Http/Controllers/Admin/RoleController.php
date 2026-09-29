<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Permission;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Role;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission as PermissionModel;

class RoleController extends Controller
{
    /**
     * Show the code-owned roles, their stored permissions and any drift between code and database.
     */
    public function index(): Response
    {
        Gate::authorize('viewAny', Role::class);

        $storedRoles = Role::query()
            ->where('guard_name', 'web')
            ->with('permissions:id,name')
            ->withCount('users')
            ->get()
            ->keyBy('name');
        $storedPermissions = PermissionModel::query()
            ->where('guard_name', 'web')
            ->pluck('name');

        $roles = collect(UserRole::cases())->map(function (UserRole $role) use ($storedRoles): array {
            $storedRole = $storedRoles->get($role->value);
            $assignedPermissions = $storedRole?->permissions->pluck('name')->sort()->values()->all() ?? [];
            $declaredPermissions = collect($role->permissions())
                ->map(fn (Permission $permission): string => $permission->value)
                ->sort()
                ->values()
                ->all();

            return [
                'name' => $role->value,
                'label' => $role->label(),
                'description' => $role->description(),
                'userCount' => (int) ($storedRole?->users_count ?? 0),
                'permissions' => $assignedPermissions,
                'isStored' => $storedRole !== null,
                'isSynchronized' => $storedRole !== null && $assignedPermissions === $declaredPermissions,
            ];
        })->values();

        $roleNames = collect(UserRole::all());
        $permissionNames = collect(Permission::cases())->map(fn (Permission $permission): string => $permission->value);
        $missingRoles = $roleNames->diff($storedRoles->keys())->values();
        $missingPermissions = $permissionNames->diff($storedPermissions)->values();
        $unexpectedRoles = $storedRoles->keys()->diff($roleNames)->values();
        $unexpectedPermissions = $storedPermissions->diff($permissionNames)->values();

        return Inertia::render('backend/roles/index', [
            'roles' => $roles,
            'permissionGroups' => $this->permissionGroups($storedPermissions),
            'synchronization' => [
                'isSynchronized' => $roles->every(fn (array $role): bool => $role['isSynchronized'])
                    && $missingRoles->isEmpty()
                    && $missingPermissions->isEmpty()
                    && $unexpectedRoles->isEmpty()
                    && $unexpectedPermissions->isEmpty(),
                'missingRoles' => $missingRoles,
                'missingPermissions' => $missingPermissions,
                'unexpectedRoles' => $unexpectedRoles,
                'unexpectedPermissions' => $unexpectedPermissions,
            ],
        ]);
    }

    /**
     * @param  Collection<int, string>  $storedPermissions
     * @return list<array{key: string, label: string, permissions: list<array{value: string, label: string, description: string, isStored: bool}>}>
     */
    private function permissionGroups(Collection $storedPermissions): array
    {
        $groups = [];

        foreach (Permission::cases() as $permission) {
            $group = $permission->group();
            $groups[$group] ??= [
                'key' => $group,
                'label' => $permission->groupLabel(),
                'permissions' => [],
            ];
            $groups[$group]['permissions'][] = [
                'value' => $permission->value,
                'label' => $permission->label(),
                'description' => $permission->description(),
                'isStored' => $storedPermissions->contains($permission->value),
            ];
        }

        return array_values($groups);
    }
}
