<?php

use App\Enums\ParkingStatus;
use App\Models\Country;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingSpace;
use App\Models\User;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->netherlands = Country::factory()->create(['code' => 'NL']);
    $this->amsterdam = Municipality::factory()->for($this->netherlands)->create(['name' => 'Amsterdam']);
    $this->area = ['country' => 'nl', 'municipality' => 'amsterdam'];
    $this->queue = route('areas.municipality.check', $this->area);
});

it('asks a guest to sign in before the first published Amsterdam parking space and records the confirmation', function () {
    $parking = ParkingSpace::factory()->for($this->amsterdam)->create(['status' => ParkingStatus::APPROVED]);
    $user = User::factory()->create();
    $identity = ['source' => 'community', 'id' => $parking->id];
    $check = route('areas.municipality.check', $this->area + $identity);
    $this->get(route('areas.municipality', $this->area))->assertInertia(fn (Assert $page) => $page
        ->where('totals.spaces', 1)->where('check_area', $this->area));
    $this->get($this->queue)->assertOk()->assertHeader('X-Robots-Tag', 'noindex')->assertInertia(fn (Assert $page) => $page
        ->component('frontend/areas/parking-check')->where('state', 'sign_in')->where('place', null)->whereNot('preview', null));
    $this->get($check)->assertInertia(fn (Assert $page) => $page->where('state', 'sign_in')->where('place', null));

    $this->get(route('login', ['return' => route('areas.municipality.check', $this->area, absolute: false)]))->assertOk();
    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])->assertRedirect($this->queue);
    $this->get($this->queue)->assertRedirect($check);
    $this->get($check)->assertInertia(fn (Assert $page) => $page
        ->where('place.id', $parking->id)->where('state', 'ready')->where('canContribute', true)->where('skipped', false)
        ->where('place.orientation', $parking->orientation->label())->where('place.last_confirmed_at', null)->where('preview', null));

    $this->from($check)->post(route('map.places.confirm', $identity))->assertRedirect($check);
    $this->get($check)->assertInertia(fn (Assert $page) => $page->where('state', 'confirmed')->whereNot('place.last_confirmed_at', null));
    $this->get($this->queue)->assertInertia(fn (Assert $page) => $page->where('state', 'empty'));
});

it('returns a new account to the check after registering and again after verifying its email address', function () {
    $parking = ParkingSpace::factory()->for($this->amsterdam)->create(['status' => ParkingStatus::APPROVED]);
    $check = route('areas.municipality.check', $this->area + ['source' => 'community', 'id' => $parking->id]);

    $this->get(route('register', ['return' => route('areas.municipality.check', $this->area, absolute: false)]))->assertOk();
    $this->post(route('register.store'), [
        'name' => 'Nieuwe bewoner', 'email' => 'bewoner@example.com', 'password' => 'password', 'password_confirmation' => 'password',
    ])->assertRedirect($this->queue);
    $this->get($this->queue)->assertRedirect($check);
    $this->get($check)->assertInertia(fn (Assert $page) => $page->where('state', 'ready')->where('canContribute', false));

    $user = User::where('email', 'bewoner@example.com')->firstOrFail();
    $this->get(URL::temporarySignedRoute('verification.verify', now()->addHour(), ['id' => $user->id, 'hash' => sha1($user->email)]))
        ->assertRedirect($check);
    $this->get($check)->assertInertia(fn (Assert $page) => $page->where('state', 'ready')->where('canContribute', true));
});

it('skips to the next parking space without recording an answer', function () {
    $first = ParkingMunicipal::factory()->for($this->amsterdam)->create(['id' => 'a-first', 'visibility' => true]);
    $second = ParkingMunicipal::factory()->for($this->amsterdam)->create(['id' => 'b-second', 'visibility' => true]);
    $user = User::factory()->create();
    $secondCheck = route('areas.municipality.check', $this->area + ['source' => 'municipal', 'id' => $second->id, 'skipped' => 1]);

    $this->actingAs($user)->get(route('areas.municipality.check', $this->area + ['source' => 'municipal', 'id' => $first->id, 'next' => 1, 'skipped' => 1]))
        ->assertRedirect($secondCheck);
    $this->get($secondCheck)->assertInertia(fn (Assert $page) => $page->where('place.id', $second->id)->where('skipped', true));
    expect($first->confirmations()->count())->toBe(0)
        ->and($first->reports()->count())->toBe(0);
});

it('advances past a withdrawn place to a published record in the same municipality and sends reports to moderation', function () {
    $other = Municipality::factory()->for($this->netherlands)->create();
    ParkingMunicipal::factory()->for($other)->create(['id' => 'a-other', 'visibility' => true]);
    ParkingMunicipal::factory()->for($this->amsterdam)->create(['id' => 'b-hidden', 'visibility' => false]);
    ParkingSpace::factory()->for($this->amsterdam)->create(['status' => ParkingStatus::PENDING]);
    $first = ParkingMunicipal::factory()->for($this->amsterdam)->create(['id' => 'c-withdrawn', 'visibility' => true]);
    $second = ParkingMunicipal::factory()->for($this->amsterdam)->create(['id' => 'd-published', 'visibility' => true]);
    $user = User::factory()->create();
    $identity = ['source' => 'municipal', 'id' => $first->id];
    $firstCheck = route('areas.municipality.check', $this->area + $identity);

    $this->actingAs($user)->get($this->queue)->assertRedirect($firstCheck);
    $first->update(['visibility' => false]);
    $this->get($firstCheck)->assertInertia(fn (Assert $page) => $page->where('state', 'withdrawn')->where('place', null));
    $this->get(route('areas.municipality.check', $this->area + ['source' => 'municipal', 'id' => 'a-other']))
        ->assertInertia(fn (Assert $page) => $page->where('state', 'withdrawn')->where('place', null));

    $secondIdentity = ['source' => 'municipal', 'id' => $second->id];
    $secondCheck = route('areas.municipality.check', $this->area + $secondIdentity);
    $this->get(route('areas.municipality.check', $this->area + $identity + ['next' => 1]))->assertRedirect($secondCheck);
    $this->from($secondCheck)->post(route('map.places.report', $secondIdentity), ['reason' => 'sign_removed'])->assertRedirect($secondCheck);
    $this->assertDatabaseHas('parking_place_reports', ['parking_municipal_id' => $second->id, 'user_id' => $user->id, 'resolved_at' => null]);
    expect($second->refresh()->visibility)->toBeTrue();
    $this->get($secondCheck)->assertInertia(fn (Assert $page) => $page->where('state', 'reported'));
    $this->get(route('areas.municipality.check', $this->area + $secondIdentity + ['next' => 1]))
        ->assertInertia(fn (Assert $page) => $page->where('state', 'empty')->where('place', null));
    $this->get($this->queue)->assertInertia(fn (Assert $page) => $page->where('state', 'empty'));
});
