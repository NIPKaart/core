<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class PermissionsTableSeeder extends Seeder
{
    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $roles = config('permissions.roles');

        foreach ($roles as $roleName => $roleData) {
            $guardName = $roleData['guard_name'] ?? 'web';

            $role = Role::firstOrCreate([
                'name' => $roleName,
                'guard_name' => $guardName,
            ]);

            $this->assignResourcePermissions(
                $roleData['permissions']['resource'] ?? [],
                $role,
                $guardName
            );
        }
    }

    protected function assignResourcePermissions(array $resources, Role $role, string $guardName): void
    {
        foreach ($resources as $resource => $actions) {
            foreach ($actions as $action) {
                // Resource keeps exactly as defined (e.g. test-resource), so permission = "test-resource.view"
                $permissionName = "{$resource}.{$action}";

                $permission = Permission::firstOrCreate([
                    'name' => $permissionName,
                    'guard_name' => $guardName,
                ]);

                $role->givePermissionTo($permission);
            }
        }
    }
}

