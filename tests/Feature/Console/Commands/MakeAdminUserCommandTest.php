<?php

use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;

it('creates a verified administrator with the supplied password', function () {
    $this->artisan('nipkaart:make-admin', [
        'email' => 'admin@example.com', '--name' => 'Administrator', '--password' => 'explicit-password',
    ])->doesntExpectOutputToContain('explicit-password')->assertSuccessful();

    $user = User::where('email', 'admin@example.com')->firstOrFail();

    expect($user->name)->toBe('Administrator');
    expect($user->hasVerifiedEmail())->toBeTrue();
    expect(Hash::check('explicit-password', $user->password))->toBeTrue();
    expect($user->hasRole(UserRole::ADMIN))->toBeTrue();
    expect($user->can('user.update'))->toBeTrue();
});

it('displays a working generated password only at creation', function () {
    $result = Artisan::call('nipkaart:make-admin', ['email' => 'admin@example.com', '--name' => 'Administrator']);
    $output = Artisan::output();
    preg_match('/Generated password: (.+)/', $output, $matches);
    $password = trim($matches[1]);
    $user = User::where('email', 'admin@example.com')->firstOrFail();

    expect($result)->toBe(0);
    expect(strlen($password))->toBe(24);
    expect(Hash::check($password, $user->password))->toBeTrue();

    $attributes = $user->refresh()->getAttributes();
    $roleCount = Role::count();

    $this->artisan('nipkaart:make-admin', ['email' => $user->email])
        ->doesntExpectOutputToContain($password)
        ->doesntExpectOutputToContain('Generated password:')
        ->expectsOutput('admin@example.com is already an administrator.')
        ->assertSuccessful();

    expect($user->refresh()->getAttributes())->toBe($attributes);
    $this->assertDatabaseCount('roles', $roleCount);
    $this->assertDatabaseCount('users', 1);
    $this->assertDatabaseCount('model_has_roles', 1);
});

it('promotes an ordinary user while preserving account data and other roles', function () {
    $user = User::factory()->unverified()->create(['locale' => 'nl']);
    $user->assignRole(UserRole::USER);
    $attributes = $user->refresh()->getAttributes();

    $this->artisan('nipkaart:make-admin', [
        'email' => $user->email, '--name' => 'Replacement', '--password' => 'replacement-password',
    ])->doesntExpectOutputToContain('replacement-password')
        ->doesntExpectOutputToContain($user->password)
        ->assertSuccessful();

    expect($user->refresh()->getAttributes())->toBe($attributes);
    expect($user->hasAllRoles([UserRole::ADMIN, UserRole::USER]))->toBeTrue();
});

it('rejects suspended accounts without changing their state or roles', function () {
    $user = User::factory()->create(['suspended_at' => now()]);
    $attributes = $user->refresh()->getAttributes();

    $this->artisan('nipkaart:make-admin', ['email' => $user->email])
        ->expectsOutput('Cannot grant administrator access to a suspended user.')
        ->assertFailed();

    expect($user->refresh()->getAttributes())->toBe($attributes);
    expect($user->hasRole(UserRole::ADMIN))->toBeFalse();
});

it('fails clearly when the administrator role is unavailable', function () {
    Role::findByName(UserRole::ADMIN->value, 'web')->delete();

    $this->artisan('nipkaart:make-admin', ['email' => 'admin@example.com', '--name' => 'Administrator'])
        ->expectsOutput('Administrator role is unavailable. Run php artisan db:seed --class=PermissionsTableSeeder first.')
        ->assertFailed();

    $this->assertDatabaseCount('users', 0);
    $this->assertDatabaseMissing('roles', ['name' => 'admin', 'guard_name' => 'web']);
});

it('rejects invalid input without creating an account', function (array $options) {
    $this->artisan('nipkaart:make-admin', array_replace([
        'email' => 'admin@example.com', '--name' => 'Administrator', '--password' => 'explicit-password', '--no-interaction' => true,
    ], $options))->assertFailed();

    $this->assertDatabaseCount('users', 0);
})->with([
    'missing email' => [['email' => null]],
    'invalid email' => [['email' => 'invalid']],
    'uppercase email' => [['email' => 'ADMIN@example.com']],
    'missing name' => [['--name' => null]],
    'blank name' => [['--name' => '']],
    'long name' => [['--name' => str_repeat('a', 256)]],
    'short password' => [['--password' => 'short']],
    'blank password' => [['--password' => '']],
]);

it('asks for the email and new account name interactively', function () {
    $this->artisan('nipkaart:make-admin', ['--password' => 'explicit-password'])
        ->expectsQuestion('Email address', 'admin@example.com')
        ->expectsQuestion('Name', 'Administrator')
        ->assertSuccessful();

    expect(User::where('email', 'admin@example.com')->firstOrFail()->hasRole(UserRole::ADMIN))->toBeTrue();
});
