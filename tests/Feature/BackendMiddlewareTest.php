<?php

use App\Models\User;

test('web requests still use the unencrypted locale cookie', function () {
    $this->withUnencryptedCookie('locale', 'nl')->get(route('login'))->assertOk();

    expect(app()->getLocale())->toBe('nl');
});

test('the user locale still takes priority over the locale cookie', function () {
    $user = User::factory()->create(['locale' => 'nl']);

    $this->actingAs($user)->withUnencryptedCookie('locale', 'en')->get(route('dashboard'))->assertOk();

    expect(app()->getLocale())->toBe('nl');
});

test('suspended users are still logged out of web routes', function () {
    $user = User::factory()->create(['suspended_at' => now()]);

    $this->actingAs($user)->get(route('dashboard'))
        ->assertRedirect(route('login'))->assertSessionHasErrors('email');

    $this->assertGuest();
});

test('broadcast authorization still protects private user channels', function () {
    config()->set('broadcasting.default', 'reverb');
    config()->set('broadcasting.connections.reverb.key', 'test-key');
    config()->set('broadcasting.connections.reverb.secret', 'test-secret');
    config()->set('broadcasting.connections.reverb.app_id', 'test-app');
    $user = User::factory()->create();

    $this->actingAs($user)->postJson('/broadcasting/auth', [
        'channel_name' => 'private-App.Models.User.'.$user->id,
        'socket_id' => '123.456',
    ])->assertOk();

    $this->postJson('/broadcasting/auth', [
        'channel_name' => 'private-App.Models.User.'.($user->id + 1),
        'socket_id' => '123.456',
    ])->assertForbidden();
});
