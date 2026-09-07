<?php

use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('municipal operators can browse municipalities and their parking records', function () {
    $space = ParkingMunicipal::factory()->create(['visibility' => true]);
    $operator = User::factory()->create();
    $operator->givePermissionTo('parking-municipal.view_any');
    $this->actingAs($operator);

    $this->get(route('app.parking-municipal.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('backend/parking-municipal/municipalities')
            ->has('municipalities', 1)
            ->where('municipalities.0.id', $space->municipality_id)
            ->where('municipalities.0.visible_spaces', 1));

    $this->get(route('app.parking-municipal.municipality', $space->municipality_id))
        ->assertInertia(fn (Assert $page) => $page
            ->component('backend/parking-municipal/index')
            ->has('spaces.data', 1)
            ->where('spaces.data.0.id', $space->id));
});

test('offstreet operators can browse imported parking records', function () {
    $space = ParkingOffstreet::factory()->create();
    $operator = User::factory()->create();
    $operator->givePermissionTo('parking-offstreet.view_any');

    $this->actingAs($operator)->get(route('app.parking-offstreet.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('backend/parking-offstreet/index')
            ->has('spaces.data', 1)
            ->where('spaces.data.0.id', $space->id));
});

test('imported parking visibility changes only the selected records', function (string $model, string $permission, string $route) {
    $space = $model::factory()->create(['visibility' => true]);
    $other = $model::factory()->create(['visibility' => true]);
    $operator = User::factory()->create();
    $operator->givePermissionTo($permission);

    $this->actingAs($operator)->from('/dashboard')->post(route($route), [
        'ids' => [$space->id],
        'visibility' => false,
    ])->assertRedirect('/dashboard');

    expect($space->fresh()->visibility)->toBeFalse();
    expect($other->fresh()->visibility)->toBeTrue();
})->with([
    'municipal' => [ParkingMunicipal::class, 'parking-municipal.update', 'app.parking-municipal.toggle-visibility'],
    'offstreet' => [ParkingOffstreet::class, 'parking-offstreet.update', 'app.parking-offstreet.toggle-visibility'],
]);

test('users without import permissions cannot change visibility', function (string $model, string $route) {
    $space = $model::factory()->create(['visibility' => true]);

    $this->actingAs(User::factory()->create())->post(route($route), [
        'ids' => [$space->id],
        'visibility' => false,
    ])->assertForbidden();

    expect($space->fresh()->visibility)->toBeTrue();
})->with([
    'municipal' => [ParkingMunicipal::class, 'app.parking-municipal.toggle-visibility'],
    'offstreet' => [ParkingOffstreet::class, 'app.parking-offstreet.toggle-visibility'],
]);
