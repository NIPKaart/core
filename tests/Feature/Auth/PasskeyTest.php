<?php

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Tests\Support\VirtualPasskey;

beforeEach(function () {
    config(['passkeys.relying_party_id' => 'nipkaart.test', 'passkeys.allowed_origins' => ['https://nipkaart.test']]);
});

function enrollPasskey($test, User $user): array
{
    $device = new VirtualPasskey;
    $options = $test->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->getJson(route('passkey.registration-options'))->assertOk()->json('options');
    $credential = $device->register($options, 'https://nipkaart.test');
    $test->postJson(route('passkey.store'), ['name' => 'Test device', 'credential' => $credential])->assertSuccessful();

    return [$device, $options['user']['id']];
}

test('passkey registration login and reauthentication use real signatures', function () {
    $user = User::factory()->create();
    [$device, $handle] = enrollPasskey($this, $user);
    expect($user->passkeys()->count())->toBe(1);
    Auth::logout();
    $options = $this->getJson(route('passkey.login-options'))->assertOk()->json('options');
    $credential = $device->sign($options, 'https://nipkaart.test', $handle);
    $this->postJson(route('passkey.login'), ['credential' => $credential])->assertOk();
    $this->assertAuthenticatedAs($user);
    expect($user->passkeys()->first()->last_used_at)->not->toBeNull();

    $this->withSession(['auth.password_confirmed_at' => 0])->get(route('security.edit'))->assertRedirect(route('password.confirm'));
    $options = $this->getJson(route('passkey.confirm-options'))->assertOk()->json('options');
    $this->postJson(route('passkey.confirm'), ['credential' => $device->sign($options, 'https://nipkaart.test', $handle)])->assertOk();
    $this->get(route('security.edit'))->assertOk();
    $this->deleteJson(route('passkey.destroy', $user->passkeys()->first()->id))->assertOk();
    expect($user->passkeys()->count())->toBe(0);
});

test('passkeys reject wrong origin challenge signature and missing user verification', function (string $fault) {
    $user = User::factory()->create();
    [$device, $handle] = enrollPasskey($this, $user);
    Auth::logout();
    $options = $this->getJson(route('passkey.login-options'))->assertOk()->json('options');
    if ($fault === 'challenge') {
        $options['challenge'] = 'd3JvbmctY2hhbGxlbmdl';
    }
    $credential = $device->sign($options, $fault === 'origin' ? 'https://attacker.test' : 'https://nipkaart.test', $handle, $fault !== 'verification');
    if ($fault === 'signature') {
        $credential['response']['signature'] = 'aW52YWxpZA';
    }
    $this->postJson(route('passkey.login'), ['credential' => $credential])->assertUnprocessable();
    $this->assertGuest();
})->with(['origin', 'challenge', 'signature', 'verification']);

test('passkey challenges cannot be replayed or used without a session', function () {
    $user = User::factory()->create();
    [$device, $handle] = enrollPasskey($this, $user);
    Auth::logout();
    $options = $this->getJson(route('passkey.login-options'))->assertOk()->json('options');
    $credential = $device->sign($options, 'https://nipkaart.test', $handle);
    $this->postJson(route('passkey.login'), ['credential' => $credential])->assertOk();
    Auth::logout();
    $this->postJson(route('passkey.login'), ['credential' => $credential])->assertUnprocessable()->assertJsonValidationErrors('credential');
    $this->assertGuest();
});

test('a valid passkey cannot authenticate a suspended account', function () {
    $user = User::factory()->create();
    [$device, $handle] = enrollPasskey($this, $user);
    $user->update(['suspended_at' => now()]);
    Auth::logout();
    $options = $this->getJson(route('passkey.login-options'))->assertOk()->json('options');
    $this->postJson(route('passkey.login'), ['credential' => $device->sign($options, 'https://nipkaart.test', $handle)])->assertUnprocessable();
    $this->assertGuest();
});

test('passkey management requires verified email and recent confirmation', function () {
    $this->getJson(route('passkey.registration-options'))->assertUnauthorized();
    $user = User::factory()->unverified()->create();
    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->getJson(route('passkey.registration-options'))->assertForbidden();
    $this->postJson(route('passkey.store'), [])->assertForbidden();
    $user->markEmailAsVerified();
    $this->withSession(['auth.password_confirmed_at' => 0])->getJson(route('passkey.registration-options'))->assertStatus(423);
    $this->postJson(route('passkey.store'), [])->assertStatus(423);
});

test('other users cannot delete or confirm with an owned passkey', function () {
    $owner = User::factory()->create();
    [$device, $handle] = enrollPasskey($this, $owner);
    $other = User::factory()->create();
    $this->actingAs($other)->deleteJson(route('passkey.destroy', $owner->passkeys()->first()->id))->assertForbidden();
    $options = $this->getJson(route('passkey.confirm-options'))->assertOk()->json('options');
    $this->withSession(['auth.password_confirmed_at' => 0])->postJson(route('passkey.confirm'), [
        'credential' => $device->sign($options, 'https://nipkaart.test', $handle),
    ])->assertUnprocessable();
    expect(session('auth.password_confirmed_at'))->toBe(0);
});

test('passkey login options are rate limited', function () {
    for ($attempt = 0; $attempt < 10; $attempt++) {
        $this->getJson(route('passkey.login-options'))->assertOk();
    }
    $this->getJson(route('passkey.login-options'))->assertStatus(429);
});

test('invalid registration origins and expired registration sessions are rejected', function () {
    $user = User::factory()->create();
    $device = new VirtualPasskey;
    $options = $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->getJson(route('passkey.registration-options'))->assertOk()->json('options');
    $this->postJson(route('passkey.store'), ['name' => 'Invalid', 'credential' => $device->register($options, 'https://attacker.test')])->assertUnprocessable();
    $this->postJson(route('passkey.store'), ['name' => 'Expired', 'credential' => $device->register($options, 'https://nipkaart.test')])->assertUnprocessable();
    expect($user->passkeys()->count())->toBe(0);
});

test('passkey removal needs fresh confirmation and account deletion removes passkeys', function () {
    $user = User::factory()->create();
    enrollPasskey($this, $user);
    $id = $user->passkeys()->first()->id;
    $this->withSession(['auth.password_confirmed_at' => 0])->deleteJson(route('passkey.destroy', $id))->assertStatus(423);
    expect($user->passkeys()->count())->toBe(1);
    $this->delete(route('profile.destroy'), ['password' => 'password'])->assertRedirect(route('home'));
    $this->assertDatabaseMissing('passkeys', ['id' => $id]);
});
