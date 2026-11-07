<?php

use App\Enums\ParkingStatus;
use App\Models\Country;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingSpace;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->netherlands = Country::factory()->create(['code' => 'NL']);
    $this->amsterdam = Municipality::factory()->for($this->netherlands)->create(['name' => 'Amsterdam']);
    $this->area = ['country' => 'nl', 'municipality' => 'amsterdam'];
    $this->queue = route('areas.municipality.check', $this->area);
});

it('restores the same published Amsterdam parking space after signing in and records the confirmation', function () {
    $parking = ParkingSpace::factory()->for($this->amsterdam)->create(['status' => ParkingStatus::APPROVED]);
    $user = User::factory()->create();
    $identity = ['source' => 'community', 'id' => $parking->id];
    $check = route('areas.municipality.check', $this->area + $identity);
    $this->get(route('areas.municipality', $this->area))->assertInertia(fn (Assert $page) => $page
        ->where('totals.spaces', 1)->where('check_area', $this->area));
    $this->get($this->queue)->assertRedirect($check);
    $this->get($check)->assertOk()->assertHeader('X-Robots-Tag', 'noindex')->assertInertia(fn (Assert $page) => $page
        ->component('frontend/areas/parking-check')->where('place.id', $parking->id)->where('state', 'ready')->where('canContribute', false));

    $this->get(route('login', ['return' => route('areas.municipality.check', $this->area + $identity, absolute: false)]))->assertOk();
    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])->assertRedirect($check);
    $this->get($check)->assertInertia(fn (Assert $page) => $page
        ->where('place.id', $parking->id)->where('state', 'ready')->where('canContribute', true));

    $this->from($check)->post(route('map.places.confirm', $identity))->assertRedirect($check);
    $this->get($check)->assertInertia(fn (Assert $page) => $page->where('state', 'confirmed'));
    $this->get($this->queue)->assertInertia(fn (Assert $page) => $page->where('state', 'empty'));
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
