<?php

use App\Enums\ApiState;
use App\Models\Municipality;
use App\Models\ParkingOffstreet;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->freezeTime();
});

/** A visible garage with a current general count; override to describe other feed states. */
function previewGarage(Municipality $municipality, array $state = []): ParkingOffstreet
{
    return ParkingOffstreet::factory()->for($municipality)->create([
        'visibility' => true, 'parking_type' => 'garage', 'api_state' => ApiState::OK, 'occupancy_status' => 'counting',
        'capacity' => 400, 'free_space' => 37, 'observed_at' => now()->subMinute(), ...$state,
    ]);
}

it('previews the garages with the most free spaces where most garages report live', function () {
    $utrecht = Municipality::factory()->create(['name' => 'Utrecht']);
    $amsterdam = Municipality::factory()->create(['name' => 'Amsterdam']);
    previewGarage($utrecht, ['name' => 'Jaarbeurs', 'free_space' => 900]);
    foreach ([['Centrum', 12], ['Zuidas', 250], ['Noord', 80], ['Oost', 40]] as [$name, $free]) {
        previewGarage($amsterdam, ['name' => $name, 'free_space' => $free]);
    }
    previewGarage($amsterdam, ['name' => 'Stale', 'free_space' => 999, 'observed_at' => now()->subMinutes(11)]);
    previewGarage($amsterdam, ['name' => 'Hidden', 'free_space' => 999, 'visibility' => false]);

    $this->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('frontend/home')
            ->where('garages.municipality.name', 'Amsterdam')
            ->where('garages.total', 5)
            ->count('garages.municipality.garages', 3)
            ->where('garages.municipality.garages.0.name', 'Zuidas')
            ->where('garages.municipality.garages.0.free_space', 250)
            ->where('garages.municipality.garages.1.name', 'Noord')
            ->where('garages.municipality.garages.2.name', 'Oost'));
});

it('shows no garage preview when no measurement is current', function () {
    $amsterdam = Municipality::factory()->create();
    previewGarage($amsterdam, ['observed_at' => now()->subMinutes(11)]);
    previewGarage($amsterdam, ['api_state' => ApiState::ERROR]);

    $this->get(route('home'))->assertInertia(fn (Assert $page) => $page->where('garages', null));
});

it('renders the about and contact pages without an account', function (string $route, string $component) {
    $this->get(route($route))->assertOk()->assertInertia(fn (Assert $page) => $page->component($component));
})->with([
    'about' => ['about', 'frontend/about'],
    'contact' => ['contact', 'frontend/contact'],
]);
