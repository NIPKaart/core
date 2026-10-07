<?php

use App\Enums\UserRole;
use App\Models\Country;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;

it('uses the guest cookie consistently on public pages', function (string $locale) {
    $this->withUnencryptedCookie('locale', $locale)->get(route('contact'))
        ->assertInertia(fn (Assert $page) => $page->where('locale', $locale));
})->with(['nl', 'en']);

it('persists the account language and uses it on later visits', function (string $locale) {
    $user = User::factory()->create(['locale' => $locale === 'nl' ? 'en' : 'nl']);

    $this->actingAs($user)->patch(route('locale.update'), ['locale' => $locale])->assertRedirect();

    expect($user->refresh()->locale)->toBe($locale);
    $this->withUnencryptedCookie('locale', $locale === 'nl' ? 'en' : 'nl')->get(route('profile.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('locale', $locale));
})->with(['nl', 'en']);

it('shows contact validation in the selected language without sending mail', function (string $locale, string $message) {
    Mail::fake();

    $this->withUnencryptedCookie('locale', $locale)->post(route('contact.store'), [
        'topic' => 'question', 'name' => 'Sam', 'email' => 'sam@example.com', 'message' => '',
    ])->assertSessionHasErrors(['message' => $message]);

    Mail::assertNothingQueued();
})->with([
    ['nl', 'Bericht is verplicht.'],
    ['en', 'The message field is required.'],
]);

it('shows failed authentication in the selected language', function (string $locale, string $message) {
    $this->withUnencryptedCookie('locale', $locale)->post(route('login.store'), [
        'email' => 'missing@example.com', 'password' => 'wrong-password',
    ])->assertSessionHasErrors(['email' => $message]);

    $this->assertGuest();
})->with([
    ['nl', 'Deze combinatie van e-mailadres en wachtwoord is niet geldig.'],
    ['en', 'These credentials do not match our records.'],
]);

it('translates the orientation validation for a community contribution', function (string $locale, string $message) {
    $user = User::factory()->create(['locale' => $locale]);

    $this->actingAs($user)->post(route('location-map.store'), [
        'latitude' => 52.37, 'longitude' => 4.9, 'under_sign' => 'no',
    ])->assertSessionHasErrors(['orientation' => $message]);

    expect($user->parkingSpaces()->count())->toBe(0);
})->with([
    ['nl', 'Kies een oriëntatie voor de parkeerplaats.'],
    ['en', 'Select an orientation for the parking space.'],
]);

it('translates the municipality validation for a parking rule', function (string $locale, string $message) {
    $admin = User::factory()->create(['locale' => $locale]);
    $admin->assignRole(UserRole::ADMIN);
    $country = Country::factory()->create();

    $this->actingAs($admin)->post(route('app.parking-rules.store'), [
        'country_id' => $country->id, 'nationwide' => false, 'url' => 'https://example.com/rules',
    ])->assertSessionHasErrors(['municipality_id' => $message]);
})->with([
    ['nl', 'Kies een gemeente, tenzij deze regel landelijk geldt.'],
    ['en', 'Please select a municipality unless this rule is nationwide.'],
]);

it('sends password reset mail in the account language outside a localized request', function (string $locale, string $subject, string $greeting, string $footer) {
    config(['mail.default' => 'array']);
    app()->setLocale($locale === 'nl' ? 'en' : 'nl');
    $user = User::factory()->make(['locale' => $locale]);

    $user->notify(new ResetPassword('test-token'));

    $message = Mail::mailer()->getSymfonyTransport()->messages()->sole()->getOriginalMessage();
    expect($message->getSubject())->toBe($subject);
    expect($message->getHtmlBody())->toContain($greeting, $footer);
    expect(app()->getLocale())->toBe($locale === 'nl' ? 'en' : 'nl');
})->with([
    ['nl', 'Je wachtwoord herstellen', 'Hallo!', 'Alle rechten voorbehouden.'],
    ['en', 'Reset your password', 'Hello!', 'All rights reserved.'],
]);

it('shows self suspension errors in the account language', function (string $locale, string $message) {
    $admin = User::factory()->create(['locale' => $locale]);
    $admin->assignRole(UserRole::ADMIN);

    $this->actingAs($admin)->put(route('app.users.suspend', $admin))
        ->assertSessionHasErrors(['suspended_at' => $message]);

    expect($admin->refresh()->suspended_at)->toBeNull();
})->with([
    ['nl', 'Je kunt jezelf niet schorsen.'],
    ['en', 'You cannot suspend yourself.'],
]);

it('shows malformed passkey errors in the selected language', function (string $locale, string $message) {
    $this->withCredentials()->withUnencryptedCookie('locale', $locale)->postJson(route('passkey.login'), [
        'credential' => ['id' => 'invalid', 'rawId' => 'invalid', 'type' => 'public-key', 'response' => ['clientDataJSON' => 'invalid']],
    ])
        ->assertUnprocessable()->assertJsonValidationErrors(['credential' => $message]);

    $this->assertGuest();
})->with([
    ['nl', 'Ongeldig formaat van inloggegevens.'],
    ['en', 'Invalid credential format.'],
]);

it('ignores invalid preferences and negotiates a supported browser language', function (mixed $cookie) {
    $this->withUnencryptedCookie('locale', $cookie)->withHeader('Accept-Language', 'de-DE, nl-NL;q=0.9, en;q=0.8')
        ->get(route('contact'))->assertInertia(fn (Assert $page) => $page->where('locale', 'nl'));
})->with(['unknown', ['nl']]);

it('shares the language catalog and a safe configured default', function () {
    config(['app.locale' => 'invalid']);
    $this->withHeader('Accept-Language', '')->get(route('contact'))
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'en')
            ->where('localization.available', [
                ['code' => 'en', 'label' => 'English', 'formatLocale' => 'en-GB'],
                ['code' => 'nl', 'label' => 'Nederlands', 'formatLocale' => 'nl-NL'],
            ]));
});

it('stores a validated guest language in a cookie', function () {
    $this->from(route('contact'))->patch(route('locale.update'), ['locale' => 'nl'])
        ->assertRedirect(route('contact'))->assertPlainCookie('locale', 'nl');
    $this->assertGuest();
});

it('rejects an unsupported language without changing the account', function () {
    $user = User::factory()->create(['locale' => 'en']);
    $this->actingAs($user)->patch(route('locale.update'), ['locale' => 'xx'])
        ->assertSessionHasErrors('locale')->assertCookieMissing('locale');
    expect($user->refresh()->locale)->toBe('en');
});

it('uses a supported mail locale for legacy account preferences', function () {
    expect(User::factory()->make(['locale' => 'xx'])->preferredLocale())->toBe('en');
});
