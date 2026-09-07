<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('email changes require the current password even after recent confirmation', function (?string $password) {
    $user = User::factory()->create();
    $email = $user->email;

    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->patch(route('profile.update'), [
            'name' => 'Changed',
            'email' => 'changed@example.com',
            'current_password' => $password,
        ])->assertSessionHasErrors('current_password');

    expect($user->refresh()->email)->toBe($email);
    expect($user->email_verified_at)->not->toBeNull();
})->with([null, 'incorrect']);

test('unverified users can correct their email and retain locale and roles', function () {
    $user = User::factory()->unverified()->create(['locale' => 'en']);
    $user->assignRole('user');

    $this->actingAs($user)->patch(route('profile.update'), [
        'name' => $user->name,
        'email' => 'corrected@example.com',
        'current_password' => 'password',
        'locale' => 'nl',
        'suspended_at' => now(),
        'roles' => ['admin'],
    ])->assertSessionHasNoErrors();

    expect($user->refresh()->email)->toBe('corrected@example.com');
    expect($user->locale)->toBe('nl');
    expect($user->email_verified_at)->toBeNull();
    expect($user->suspended_at)->toBeNull();
    expect($user->getRoleNames()->all())->toBe(['user']);
    expect(Hash::check('password', $user->password))->toBeTrue();
});

test('unverified users cannot read or update password settings', function () {
    $user = User::factory()->unverified()->create();
    $this->actingAs($user)->get(route('password.edit'))->assertRedirect(route('verification.notice'));
    $this->put(route('password.update'), [
        'current_password' => 'password',
        'password' => 'new-password',
        'password_confirmation' => 'new-password',
    ])->assertRedirect(route('verification.notice'));
    expect(Hash::check('password', $user->refresh()->password))->toBeTrue();
});

test('unverified users retain access to profile preferences and account deletion', function () {
    $user = User::factory()->unverified()->create();
    $this->actingAs($user)->get(route('profile.edit'))->assertOk();
    $this->get(route('appearance.edit'))->assertOk();
    $this->patch(route('locale.update'), ['locale' => 'nl'])->assertRedirect();
    expect($user->refresh()->locale)->toBe('nl');
    $this->delete(route('profile.destroy'), ['password' => 'password'])->assertRedirect(route('home'));
    expect($user->fresh())->toBeNull();
    $this->assertGuest();
});

test('sensitive settings limit password guesses', function (string $method, string $routeName, array $payload) {
    $user = User::factory()->create();
    $this->actingAs($user);
    for ($attempt = 0; $attempt < 6; $attempt++) {
        $this->{$method}(route($routeName), $payload)->assertSessionHasErrors();
    }
    $this->{$method}(route($routeName), $payload)->assertStatus(429);
    expect($user->fresh())->not->toBeNull();
    expect(Hash::check('password', $user->refresh()->password))->toBeTrue();
})->with([
    ['patch', 'profile.update', ['name' => 'Changed', 'email' => 'changed@example.com', 'current_password' => 'wrong']],
    ['delete', 'profile.destroy', ['password' => 'wrong']],
    ['put', 'password.update', ['current_password' => 'wrong', 'password' => 'new-password', 'password_confirmation' => 'new-password']],
]);

test('suspended users cannot mutate settings', function () {
    $user = User::factory()->create(['suspended_at' => now()]);
    $email = $user->email;
    $this->actingAs($user)->patch(route('profile.update'), [
        'name' => 'Changed', 'email' => 'changed@example.com', 'current_password' => 'password',
    ])->assertRedirect(route('login'));
    $this->assertGuest();
    expect($user->refresh()->email)->toBe($email);
});

test('resource policies enforce permissions on direct requests', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->get(route('app.roles.index'))->assertForbidden();
    $user->givePermissionTo('role.view_any');
    $this->get(route('app.roles.index'))->assertOk();
    $this->get(route('app.roles.create'))->assertForbidden();
});

test('settings share a user budget without blocking verification or other users', function () {
    $user = User::factory()->create();
    $this->actingAs($user);
    for ($attempt = 0; $attempt < 6; $attempt++) {
        $this->delete(route('profile.destroy'), ['password' => 'wrong'])->assertSessionHasErrors('password');
    }
    $this->patch(route('profile.update'), ['name' => $user->name, 'email' => $user->email])->assertStatus(429);
    $this->put(route('password.update'), [])->assertStatus(429);
    $this->post(route('verification.send'))->assertRedirect();

    $other = User::factory()->create();
    $this->actingAs($other)->patch(route('profile.update'), [
        'name' => 'Updated', 'email' => $other->email,
    ])->assertSessionHasNoErrors();
    expect($other->refresh()->name)->toBe('Updated');
});
