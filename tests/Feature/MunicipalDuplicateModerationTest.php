<?php

use App\Enums\ParkingStatus;
use App\Enums\UserRole;
use App\Models\ParkingMunicipal;
use App\Models\ParkingSpace;
use App\Models\User;
use App\Services\MunicipalDuplicates;
use Inertia\Testing\AssertableInertia as Assert;

/** About 1.1 m of latitude. */
const METRE_OF_LATITUDE = 0.00001;

function moderator(): User
{
    return tap(User::factory()->create())->assignRole(UserRole::MODERATOR);
}

function submissionAt(ParkingStatus $status): ParkingSpace
{
    return ParkingSpace::factory()->create(['status' => $status, 'latitude' => 52.37, 'longitude' => 4.9]);
}

function municipalPlaceNorthOf(ParkingSpace $space, float $metres, bool $visible = true): ParkingMunicipal
{
    return ParkingMunicipal::factory()->create([
        'latitude' => $space->latitude + $metres * METRE_OF_LATITUDE / 1.11,
        'longitude' => $space->longitude,
        'visibility' => $visible,
    ]);
}

test('a pending submission near a visible municipal place is flagged with the distance', function () {
    $space = submissionAt(ParkingStatus::PENDING);
    $nearest = municipalPlaceNorthOf($space, 4);
    municipalPlaceNorthOf($space, 8);
    $this->actingAs(moderator());

    $this->get(route('app.parking-spaces.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('spaces.data.0.id', $space->id)
            ->where('spaces.data.0.nearby_municipal_metres', 4));

    $this->get(route('app.parking-spaces.show', $space))
        ->assertInertia(fn (Assert $page) => $page
            ->where('parkingSpace.nearby_municipal_metres', 4)
            ->has('nearbyMunicipalSpaces', 2)
            ->where('nearbyMunicipalSpaces.0.id', $nearest->id));

    expect($space->fresh()->status)->toBe(ParkingStatus::PENDING);
});

test('a pending submission is not flagged for a municipal place that is hidden or beyond the threshold', function (float $metres, bool $visible) {
    $space = submissionAt(ParkingStatus::PENDING);
    municipalPlaceNorthOf($space, $metres, $visible);

    $this->actingAs(moderator())->get(route('app.parking-spaces.show', $space))
        ->assertInertia(fn (Assert $page) => $page->where('parkingSpace.nearby_municipal_metres', null));
})->with([
    'hidden place within the threshold' => [4, false],
    'visible place beyond the threshold' => [MunicipalDuplicates::THRESHOLD_METRES + 5, true],
]);

test('hidden municipal places are left off the moderator map', function () {
    $space = submissionAt(ParkingStatus::PENDING);
    municipalPlaceNorthOf($space, 4, visible: false);

    $this->actingAs(moderator())->get(route('app.parking-spaces.show', $space))
        ->assertInertia(fn (Assert $page) => $page->has('nearbyMunicipalSpaces', 0));
});

test('a submission that is no longer pending is not flagged', function (ParkingStatus $status) {
    $space = submissionAt($status);
    municipalPlaceNorthOf($space, 4);

    $this->actingAs(moderator())->get(route('app.parking-spaces.index'))
        ->assertInertia(fn (Assert $page) => $page->where('spaces.data.0.nearby_municipal_metres', null));
})->with([ParkingStatus::APPROVED, ParkingStatus::REJECTED]);
