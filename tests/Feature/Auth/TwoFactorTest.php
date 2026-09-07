<?php

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Laravel\Fortify\Actions\EnableTwoFactorAuthentication;
use PragmaRX\Google2FA\Google2FA;

function twoFactorUser(): User
{
    $user = User::factory()->create()->refresh();
    app(EnableTwoFactorAuthentication::class)($user);
    $user->forceFill(['two_factor_confirmed_at' => now()])->save();

    return $user;
}

test('two factor setup needs verification and recent confirmation', function () {
    $user = User::factory()->unverified()->create();
    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->postJson(route('two-factor.enable'))->assertForbidden();
    $user->markEmailAsVerified();
    $this->withSession(['auth.password_confirmed_at' => 0])->postJson(route('two-factor.enable'))->assertStatus(423);
    expect($user->refresh()->two_factor_secret)->toBeNull();
});

test('two factor enrollment confirms a real TOTP and protects secrets', function () {
    $user = User::factory()->create()->refresh();
    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->postJson(route('two-factor.enable'))->assertOk();
    expect($user->refresh()->hasEnabledTwoFactorAuthentication())->toBeFalse();
    $secret = $this->getJson(route('two-factor.secret-key'))->assertOk()->json('secretKey');
    $this->getJson(route('two-factor.qr-code'))->assertOk()->assertJsonStructure(['svg', 'url']);
    expect($user->two_factor_secret)->not->toBe($secret);
    expect($user->toArray())->not->toHaveKeys(['two_factor_secret', 'two_factor_recovery_codes']);
    $this->postJson(route('two-factor.confirm'), ['code' => 'invalid'])->assertUnprocessable();
    expect($user->refresh()->hasEnabledTwoFactorAuthentication())->toBeFalse();
    $this->postJson(route('two-factor.confirm'), ['code' => app(Google2FA::class)->getCurrentOtp($secret)])->assertOk();
    expect($user->refresh()->hasEnabledTwoFactorAuthentication())->toBeTrue();
    $response = $this->getJson(route('two-factor.recovery-codes'))->assertOk();
    expect($response->headers->get('Cache-Control'))->toContain('no-store');
    expect($response->json())->toHaveCount(8);
    $this->deleteJson(route('two-factor.disable'))->assertOk();
    expect($user->refresh()->two_factor_secret)->toBeNull();
    expect($user->two_factor_recovery_codes)->toBeNull();
});

test('password login requires TOTP before establishing a session', function () {
    $user = twoFactorUser();
    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password', 'remember' => true])
        ->assertRedirect(route('two-factor.login'));
    $this->assertGuest();
    $this->postJson(route('two-factor.login.store'), ['code' => 'invalid'])->assertUnprocessable();
    $this->assertGuest();
    $code = app(Google2FA::class)->getCurrentOtp(decrypt($user->two_factor_secret));
    $this->post(route('two-factor.login.store'), ['code' => $code])->assertRedirect('/dashboard');
    $this->assertAuthenticatedAs($user);
});

test('a recovery code is single use and regeneration replaces old codes', function () {
    $user = twoFactorUser();
    $code = $user->recoveryCodes()[0];
    $this->withSession(['login.id' => $user->id])->postJson(route('two-factor.login.store'), ['recovery_code' => $code])->assertSuccessful();
    $this->assertAuthenticatedAs($user);
    expect($user->refresh()->recoveryCodes())->not->toContain($code);
    Auth::logout();
    $this->withSession(['login.id' => $user->id])->postJson(route('two-factor.login.store'), ['recovery_code' => $code])->assertUnprocessable();
    $this->assertGuest();
    $old = $user->recoveryCodes();
    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->postJson(route('two-factor.regenerate-recovery-codes'))->assertOk();
    expect(array_intersect($old, $user->refresh()->recoveryCodes()))->toBe([]);
});

test('suspension between password and TOTP blocks authentication', function () {
    $user = twoFactorUser();
    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])->assertRedirect(route('two-factor.login'));
    $user->update(['suspended_at' => now()]);
    $this->post(route('two-factor.login.store'), ['recovery_code' => $user->recoveryCodes()[0]])
        ->assertRedirect(route('login'))->assertSessionMissing('login.id');
    $this->assertGuest();
});

test('suspended users cannot begin password authentication', function () {
    $user = twoFactorUser();
    $user->update(['suspended_at' => now()]);
    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])
        ->assertSessionHasErrors('email')->assertSessionMissing('login.id');
    $this->assertGuest();
});

test('two factor challenge is rate limited and requires a pending login', function () {
    $this->get(route('two-factor.login'))->assertRedirect(route('login'));
    $user = twoFactorUser();
    $this->withSession(['login.id' => $user->id]);
    for ($attempt = 0; $attempt < 5; $attempt++) {
        $this->postJson(route('two-factor.login.store'), ['code' => 'invalid'])->assertUnprocessable();
    }
    $this->postJson(route('two-factor.login.store'), ['recovery_code' => $user->recoveryCodes()[0]])->assertStatus(429);
    $this->assertGuest();
});

test('registration preserves locale default role and unverified state', function () {
    $this->post(route('register.store'), [
        'name' => 'New user', 'email' => 'new@example.com', 'password' => 'password', 'password_confirmation' => 'password',
        'locale' => 'nl', 'roles' => ['admin'], 'email_verified_at' => now(),
    ])->assertSessionHasNoErrors();
    $user = User::where('email', 'new@example.com')->firstOrFail();
    expect($user->locale)->toBe('nl');
    expect($user->email_verified_at)->toBeNull();
    expect($user->getRoleNames()->all())->toBe(['user']);
});

test('password reset responses do not disclose account existence', function () {
    $user = User::factory()->create()->refresh();
    $existing = $this->postJson(route('password.email'), ['email' => $user->email])->assertOk()->json();
    $missing = $this->postJson(route('password.email'), ['email' => 'missing@example.com'])->assertOk()->json();
    expect($existing)->toBe($missing);
});
