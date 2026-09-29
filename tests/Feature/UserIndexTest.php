<?php

use App\Enums\UserRole;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = tap(User::factory()->create(['last_login_at' => now()]))->assignRole(UserRole::ADMIN);
});

test('signing in records the time of the last login', function () {
    $this->freezeSecond();
    $user = User::factory()->create(['last_login_at' => null]);

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password']);

    expect($user->fresh()->last_login_at->equalTo(now()))->toBeTrue();
});

test('a failed sign-in does not record a login', function () {
    $user = User::factory()->create(['last_login_at' => null]);

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'wrong-password']);

    expect($user->fresh()->last_login_at)->toBeNull();
});

test('the user list shows when each user last signed in', function () {
    $this->actingAs($this->admin)->get(route('app.users.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('backend/users/index')
            ->where('users.data.0.last_login_at', $this->admin->last_login_at->toJSON()));
});

test('facet filters narrow the user list', function (array $query, Closure $expected) {
    $moderator = tap(User::factory()->create(['last_login_at' => now()->subDays(40)]))->assignRole(UserRole::MODERATOR);
    $suspended = User::factory()->create(['suspended_at' => now(), 'last_login_at' => null]);
    $unverified = User::factory()->unverified()->create(['last_login_at' => now()->subDay()]);
    $users = compact('moderator', 'suspended', 'unverified') + ['admin' => $this->admin];

    $this->actingAs($this->admin)->get(route('app.users.index', $query))
        ->assertInertia(fn (Assert $page) => $page->where('users.data', fn ($rows) => collect($rows)->pluck('id')->sort()->values()->all()
            === collect($expected($users))->pluck('id')->sort()->values()->all()));
})->with([
    'role' => [['role' => 'moderator'], fn (array $users) => [$users['moderator']]],
    'several roles' => [['role' => 'admin,moderator'], fn (array $users) => [$users['admin'], $users['moderator']]],
    'no role' => [['role' => 'none'], fn (array $users) => [$users['suspended'], $users['unverified']]],
    'suspended' => [['status' => 'suspended'], fn (array $users) => [$users['suspended']]],
    'unverified' => [['verification' => 'unverified'], fn (array $users) => [$users['unverified']]],
    'recent login' => [['login' => 'recent'], fn (array $users) => [$users['admin'], $users['unverified']]],
    'no login' => [['login' => 'none'], fn (array $users) => [$users['suspended']]],
    'combined facets' => [['login' => 'recent', 'verification' => 'verified'], fn (array $users) => [$users['admin']]],
    'unknown values are ignored' => [['role' => 'owner', 'status' => 'deleted'], fn (array $users) => array_values($users)],
]);

test('facet counts show how many users match each option', function () {
    tap(User::factory()->create(['last_login_at' => null, 'suspended_at' => now()]))->assignRole(UserRole::MODERATOR);

    $this->actingAs($this->admin)->get(route('app.users.index', ['role' => 'moderator']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.role', ['moderator'])
            ->where('facets.role', ['user' => 0, 'moderator' => 1, 'admin' => 1, 'none' => 0])
            ->where('facets.status', ['active' => 1, 'suspended' => 1])
            ->where('facets.login', ['recent' => 1, 'none' => 1]));
});
