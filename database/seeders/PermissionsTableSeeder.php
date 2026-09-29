<?php

namespace Database\Seeders;

use App\Enums\Permission as PermissionEnum;
use App\Enums\UserRole;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class PermissionsTableSeeder extends Seeder
{
    /**
     * Seed every Permission case and sync each UserRole to exactly the permissions it declares.
     *
     * Permissions removed from a role's declaration are revoked from that role on the next run, and
     * permissions no longer declared in code are deleted along with every role and user assignment.
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $declaredPermissions = array_column(PermissionEnum::cases(), 'value');

        foreach ($declaredPermissions as $permission) {
            Permission::findOrCreate($permission, 'web');
        }

        Permission::query()
            ->where('guard_name', 'web')
            ->whereNotIn('name', $declaredPermissions)
            ->get()
            ->each->delete();

        foreach (UserRole::cases() as $role) {
            Role::findOrCreate($role->value, 'web')->syncPermissions(
                array_map(fn (PermissionEnum $permission): string => $permission->value, $role->permissions())
            );
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
