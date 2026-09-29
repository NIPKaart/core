<?php

use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission as PermissionModel;

function roleOverviewAdmin(): User
{
    return tap(User::factory()->create())->assignRole(UserRole::ADMIN);
}

test('administrators see every code-owned role with its stored permissions', function () {
    $this->actingAs(roleOverviewAdmin())->get(route('app.roles.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('backend/roles/index')
            ->has('roles', count(UserRole::cases()))
            ->where('roles.0.name', UserRole::USER->value)
            ->where('roles.0.permissions', [])
            ->where('roles.1.name', UserRole::MODERATOR->value)
            ->where('roles.1.permissions', fn ($permissions) => collect($permissions)->contains(Permission::PARKING_SPACE_UPDATE->value)
                && ! collect($permissions)->contains(Permission::USER_VIEW_ANY->value))
            ->where('roles.2.name', UserRole::ADMIN->value)
            ->where('roles.2.userCount', 1)
            ->where('roles.2.permissions', collect(Permission::cases())->pluck('value')->sort()->values()->all())
            ->where('permissionGroups.0.key', 'role')
            ->where('permissionGroups.0.permissions.0.value', Permission::ROLE_VIEW_ANY->value)
            ->where('synchronization.isSynchronized', true));
});

test('the overview reports drift between stored roles and the code', function () {
    Role::findByName(UserRole::MODERATOR->value, 'web')->givePermissionTo(Permission::USER_VIEW_ANY->value);
    PermissionModel::findOrCreate('role.create', 'web');
    Role::create(['name' => 'editor', 'guard_name' => 'web']);

    $this->actingAs(roleOverviewAdmin())->get(route('app.roles.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('roles.1.isSynchronized', false)
            ->where('roles.2.isSynchronized', true)
            ->where('synchronization.isSynchronized', false)
            ->where('synchronization.unexpectedPermissions', ['role.create'])
            ->where('synchronization.unexpectedRoles', ['editor']));
});

test('users without the overview permission are forbidden', function () {
    $this->actingAs(tap(User::factory()->create())->assignRole(UserRole::MODERATOR))
        ->get(route('app.roles.index'))
        ->assertForbidden();
});

test('roles can no longer be created, edited or deleted through the application', function (string $method, string $uri, int $status) {
    $this->actingAs(roleOverviewAdmin())->{$method}($uri)->assertStatus($status);
})->with([
    'create form' => ['get', '/app/roles/create', 404],
    'store' => ['post', '/app/roles', 405],
    'update' => ['put', '/app/roles/1', 404],
    'delete' => ['delete', '/app/roles/1', 404],
]);
