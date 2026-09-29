<?php

use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingStatus;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceConfirmation;
use App\Models\User;
use Illuminate\Database\QueryException;

beforeEach(function () {
    $this->user = User::factory()->create(['locale' => 'nl']);
});

dataset('published places', [
    'community' => fn () => ['community', ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]), 'map.parking-spaces.show'],
    'municipal' => fn () => ['municipal', ParkingMunicipal::factory()->create(['visibility' => true]), 'map.parking-municipal.show'],
]);

test('signed-in users confirm that a published community or municipal place exists', function (array $case) {
    [$source, $place] = $case;

    $this->actingAs($this->user)
        ->post(route('map.places.confirm', ['source' => $source, 'id' => $place->id]))
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('success', 'Bedankt, je bevestiging is opgeslagen.');

    $confirmation = $place->confirmations()->sole();
    expect($confirmation->user->is($this->user))->toBeTrue()
        ->and($confirmation->status)->toBe(ParkingConfirmationStatus::CONFIRMED);
})->with('published places');

test('a confirmation only records existence, whatever else is submitted', function () {
    $place = ParkingMunicipal::factory()->create(['visibility' => true]);

    $this->actingAs($this->user)->post(route('map.places.confirm', ['source' => 'municipal', 'id' => $place->id]), [
        'status' => ParkingConfirmationStatus::UNAVAILABLE->value,
        'comment' => 'The under-sign says 2 hours',
    ])->assertSessionHasNoErrors();

    expect($place->confirmations()->sole()->only('status', 'comment'))
        ->toBe(['status' => ParkingConfirmationStatus::CONFIRMED, 'comment' => null]);
});

test('places the public map does not show cannot be confirmed', function (string $source, Closure $id) {
    $this->actingAs($this->user)
        ->post("/map/places/{$source}/{$id()}/confirm")
        ->assertNotFound();

    expect(ParkingSpaceConfirmation::count())->toBe(0);
})->with([
    'pending community place' => ['community', fn () => ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING])->id],
    'hidden municipal place' => ['municipal', fn () => ParkingMunicipal::factory()->create(['visibility' => false])->id],
    'garage' => ['offstreet', fn () => ParkingOffstreet::factory()->create(['visibility' => true])->id],
    'malformed community id' => ['community', fn () => 'not-a-uuid'],
]);

test('each user confirms each place at most once per application day', function (array $case) {
    [$source, $place] = $case;
    $this->travelTo(now()->startOfDay()->addHours(12));
    $other = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
    $confirm = fn () => $this->post(route('map.places.confirm', ['source' => $source, 'id' => $place->id]));

    $this->actingAs($this->user);
    $confirm()->assertSessionHasNoErrors();
    $confirm()->assertSessionHasErrors(['general' => 'Je hebt deze plek vandaag al bevestigd.']);
    $this->post(route('map.places.confirm', ['source' => 'community', 'id' => $other->id]))->assertSessionHasNoErrors();
    $this->actingAs(User::factory()->create());
    $confirm()->assertSessionHasNoErrors();
    expect($place->confirmations()->count())->toBe(2);

    $this->actingAs($this->user);
    $this->travel(1)->days();
    $confirm()->assertSessionHasNoErrors();
    expect($place->confirmations()->count())->toBe(3);
})->with('published places');

test('public details report the confirmation count and latest confirmation date', function (array $case) {
    [, $place, $detailRoute] = $case;
    $factory = ParkingSpaceConfirmation::factory()->state(fn () => $place instanceof ParkingMunicipal
        ? ['parking_space_id' => null, 'parking_municipal_id' => $place->id]
        : ['parking_space_id' => $place->id]);
    $factory->create(['confirmed_at' => '2026-03-01 10:00:00']);
    $factory->create(['confirmed_at' => '2026-03-04 09:00:00']);
    // A legacy dispute is not evidence that the place exists.
    $factory->create(['confirmed_at' => '2026-03-05 09:00:00', 'status' => ParkingConfirmationStatus::MOVED]);

    $this->getJson(route($detailRoute, $place->id))
        ->assertOk()
        ->assertJsonPath('confirmations_count', ['confirmed' => 2])
        ->assertJsonPath('last_confirmed_at', '2026-03-04 09:00:00')
        ->assertJsonPath('confirmed_today', false)
        ->assertJsonMissingPath('reliability');

    $this->travelTo('2026-03-05 18:00:00');
    $factory->for($this->user)->create(['confirmed_at' => now()]);
    $this->actingAs($this->user)->getJson(route($detailRoute, $place->id))->assertJsonPath('confirmed_today', true);
})->with('published places');

test('confirmations are removed with the place they confirm', function () {
    $municipal = ParkingSpaceConfirmation::factory()->municipal()->create();
    $community = ParkingSpaceConfirmation::factory()->create();

    $municipal->parkingMunicipal->delete();
    $community->parkingSpace->forceDelete();

    $this->assertModelMissing($municipal);
    $this->assertModelMissing($community);
});

test('a confirmation targets exactly one place', function (array $targets) {
    expect(fn () => ParkingSpaceConfirmation::factory()->create($targets))->toThrow(QueryException::class);
})->with([
    'no place' => fn () => ['parking_space_id' => null],
    'two places' => fn () => ['parking_municipal_id' => ParkingMunicipal::factory()->create()->id],
]);
