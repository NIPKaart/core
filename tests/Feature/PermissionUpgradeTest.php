<?php

use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;

test('custom role model supports the v8 backed enum contract', function () {
    $role = Role::findByName(UserRole::USER, 'web');
    expect($role)->toBeInstanceOf(Role::class);
    expect(Role::findOrCreate(UserRole::USER, 'web')->id)->toBe($role->id);

    $user = User::factory()->create();
    $user->assignRole(UserRole::USER);
    expect($user->fresh()->hasRole(UserRole::USER))->toBeTrue();
    $user->removeRole(UserRole::USER);
    expect($user->fresh()->hasRole(UserRole::USER))->toBeFalse();
});

test('role and direct permission revocation take effect at the policy boundary', function () {
    $user = User::factory()->create();
    $role = Role::create(['name' => 'audit-reader', 'guard_name' => 'web']);
    $user->assignRole($role);
    $this->actingAs($user)->get(route('app.roles.index'))->assertForbidden();

    $role->givePermissionTo('role.view_any');
    $this->actingAs($user->fresh())->get(route('app.roles.index'))->assertOk();
    $this->get(route('app.roles.create'))->assertForbidden();

    $role->revokePermissionTo('role.view_any');
    $this->actingAs($user->fresh())->get(route('app.roles.index'))->assertForbidden();

    $user->givePermissionTo('role.view_any');
    $this->actingAs($user->fresh())->get(route('app.roles.index'))->assertOk();
    $user->revokePermissionTo('role.view_any');
    $this->actingAs($user->fresh())->get(route('app.roles.index'))->assertForbidden();
});
