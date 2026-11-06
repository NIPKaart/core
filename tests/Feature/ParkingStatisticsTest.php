<?php

use App\Enums\ParkingStatus;
use App\Models\Country;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use App\Models\Province;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the same public source counts on about and the signed-in dashboard', function () {
    $municipality = Municipality::factory()->create();
    $secondMunicipality = Municipality::factory()->for($municipality->province)->create();
    $garageMunicipality = Municipality::factory()->for(Province::factory()->for(Country::factory()))->create();
    $user = User::factory()->create();
    ParkingSpace::factory()->for($user)->for($municipality)->create(['status' => ParkingStatus::APPROVED]);
    ParkingMunicipal::factory()->for($municipality)->create(['visibility' => true, 'number' => 12]);
    ParkingMunicipal::factory()->for($secondMunicipality)->create(['id' => 'shared', 'visibility' => true]);
    ParkingOffstreet::factory()->for($garageMunicipality)->create(['id' => 'shared', 'visibility' => true, 'capacity' => 800]);
    ParkingOffstreet::factory()->for($municipality)->create(['visibility' => true]);
    ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);
    ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::REJECTED]);
    ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::APPROVED, 'deleted_at' => now()]);
    ParkingMunicipal::factory()->create(['visibility' => false]);
    ParkingOffstreet::factory()->create(['visibility' => false]);
    $expected = ['parking_locations' => 3, 'garages' => 2, 'municipalities' => 3, 'countries' => 2];

    $this->get(route('about'))->assertInertia(fn (Assert $page) => $page
        ->component('frontend/about')->where('statistics', $expected));
    $this->actingAs($user)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->component('dashboard')->where('statistics', $expected));
});

it('shows zero counts when there are no public locations', function () {
    ParkingMunicipal::factory()->create(['visibility' => false]);

    $this->get(route('about'))->assertInertia(fn (Assert $page) => $page->where('statistics', [
        'parking_locations' => 0, 'garages' => 0, 'municipalities' => 0, 'countries' => 0,
    ]));
});

it('refreshes the shared counts after five minutes', function () {
    $this->freezeTime();
    $garage = ParkingOffstreet::factory()->create(['visibility' => true]);
    $this->get(route('about'))->assertInertia(fn (Assert $page) => $page->where('statistics.garages', 1));
    $garage->update(['visibility' => false]);

    $this->travel(4)->minutes();
    $this->get(route('about'))->assertInertia(fn (Assert $page) => $page->where('statistics.garages', 1));
    $this->travel(1)->minutes();
    $this->get(route('about'))->assertInertia(fn (Assert $page) => $page->where('statistics.garages', 0));
});
