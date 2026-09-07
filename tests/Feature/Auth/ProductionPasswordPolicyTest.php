<?php

use App\Models\User;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;

beforeEach(function () {
    $this->app->instance('env', 'production');
    // Changing the environment also disables Laravel's test-only CSRF bypass.
    $this->withoutMiddleware(PreventRequestForgery::class);
});

afterEach(function () {
    $this->app->instance('env', 'testing');
});

test('production password policy applies to every password entry point', function (string $flow, string $password, bool $uncompromised, bool $accepted) {
    $this->mock(UncompromisedVerifier::class)
        ->shouldReceive('verify')
        ->with(['value' => $password, 'threshold' => 0])
        ->andReturn($uncompromised);

    $user = $flow === 'register' ? null : User::factory()->create();
    $data = ['password' => $password, 'password_confirmation' => $password];

    $response = match ($flow) {
        'register' => $this->post(route('register'), $data + [
            'name' => 'Test User',
            'email' => 'production@example.com',
        ]),
        'reset' => $this->post(route('password.store'), $data + [
            'email' => $user->email,
            'token' => Password::createToken($user),
        ]),
        'update' => $this->actingAs($user)->put(route('password.update'), $data + [
            'current_password' => 'password',
        ]),
    };

    if ($accepted) {
        $response->assertSessionHasNoErrors();
        $saved = $user?->refresh() ?? User::where('email', 'production@example.com')->firstOrFail();
        expect(Hash::check($password, $saved->password))->toBeTrue();
    } else {
        $response->assertSessionHasErrors('password');
        if ($user) {
            expect(Hash::check('password', $user->refresh()->password))->toBeTrue();
        } else {
            $this->assertDatabaseMissing('users', ['email' => 'production@example.com']);
        }
    }
})->with(['register', 'reset', 'update'])->with([
    'too short' => ['Abcdefghi1!', true, false],
    'no uppercase' => ['abcdefghijkl1!', true, false],
    'no lowercase' => ['ABCDEFGHIJKL1!', true, false],
    'no letters' => ['123456789012!', true, false],
    'no number' => ['Abcdefghijkl!', true, false],
    'no symbol' => ['Abcdefghijkl1', true, false],
    'compromised' => ['Abcdefghijk1!', false, false],
    'valid' => ['Abcdefghijk1!', true, true],
]);

test('existing users can still log in with a legacy password in production', function () {
    $user = User::factory()->create();

    $this->post(route('login'), ['email' => $user->email, 'password' => 'password'])
        ->assertSessionHasNoErrors();

    $this->assertAuthenticatedAs($user);
});
