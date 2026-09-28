<?php

use App\Enums\ApiState;
use App\Models\Municipality;
use App\Models\ParkingOffstreet;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->freezeTime();
});

/** A visible garage with a current general count; override to describe other feed states. */
function overviewGarage(Municipality $municipality, array $state = []): ParkingOffstreet
{
    return ParkingOffstreet::factory()->for($municipality)->create([
        'visibility' => true, 'parking_type' => 'garage', 'api_state' => ApiState::OK, 'occupancy_status' => 'counting',
        'capacity' => 400, 'free_space' => 37, 'observed_at' => now()->subMinute(), ...$state,
    ]);
}

it('groups visible garages by municipality in name order, publicly', function () {
    $utrecht = Municipality::factory()->create(['name' => 'Utrecht']);
    $amsterdam = Municipality::factory()->create(['name' => 'Amsterdam']);
    overviewGarage($utrecht, ['name' => 'Jaarbeurs']);
    overviewGarage($amsterdam, ['name' => 'Zuidas']);
    overviewGarage($amsterdam, ['name' => 'Centrum']);
    overviewGarage($amsterdam, ['name' => 'Hidden', 'visibility' => false]);

    $this->get(route('garages'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('frontend/garages')
            ->where('municipalities.0.name', 'Amsterdam')
            ->where('municipalities.0.garages.0.name', 'Centrum')
            ->where('municipalities.0.garages.1.name', 'Zuidas')
            ->where('municipalities.1.name', 'Utrecht')
            ->count('municipalities', 2)
            ->count('municipalities.0.garages', 2));
});

it('shows counts only for a current measurement, like the detail', function () {
    $amsterdam = Municipality::factory()->create(['name' => 'Amsterdam']);
    overviewGarage($amsterdam, ['name' => 'A current']);
    overviewGarage($amsterdam, ['name' => 'B stale', 'observed_at' => now()->subMinutes(11)]);
    overviewGarage($amsterdam, ['name' => 'C failing', 'api_state' => ApiState::ERROR]);
    overviewGarage($amsterdam, ['name' => 'D never measured', 'observed_at' => null, 'api_state' => null]);

    $this->get(route('garages'))->assertInertia(fn (Assert $page) => $page
        ->where('municipalities.0.garages.0.availability', 'current')
        ->where('municipalities.0.garages.0.free_space', 37)
        ->where('municipalities.0.garages.0.occupancy_status', 'counting')
        ->where('municipalities.0.garages.1.availability', 'stale')
        ->where('municipalities.0.garages.1.free_space', null)
        ->where('municipalities.0.garages.1.occupancy_status', null)
        ->where('municipalities.0.garages.2.availability', 'unavailable')
        ->where('municipalities.0.garages.2.free_space', null)
        ->where('municipalities.0.garages.3.availability', 'unknown')
        ->where('municipalities.0.garages.3.free_space', null));
});
