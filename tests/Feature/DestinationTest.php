<?php

use App\Models\Destination;
use App\Models\User;
use Illuminate\Support\Facades\Http;

function destinationPayload(): array
{
    return [
        'label' => 'Office',
        'key' => 'geoapify:office',
        'name' => 'Museumstraat, Amsterdam',
        'sub' => 'Amsterdam',
        'type' => 'street',
        'latitude' => 52.36,
        'longitude' => 4.88,
        'bounds' => ['south' => 52.35, 'north' => 52.37, 'west' => 4.87, 'east' => 4.89],
    ];
}

test('saving retains destination identity but discards filters and arbitrary metadata', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $this->actingAs($user)->postJson(route('profile.destinations.store'), [
        ...destinationPayload(), 'user_id' => $other->id, 'radius' => 5000, 'source' => 'offstreet', 'parking_count' => 23,
    ])->assertCreated()->assertJsonPath('data.label', 'Office')
        ->assertJsonPath('data.destination.key', 'geoapify:office')
        ->assertJsonPath('data.destination.label', 'Museumstraat, Amsterdam')
        ->assertJsonPath('data.destination.latitude', 52.36)
        ->assertJsonPath('data.destination.bounds.north', 52.37)
        ->assertJsonMissingPath('data.destination.radius')
        ->assertJsonMissingPath('data.destination.parking_count')
        ->assertJsonMissingPath('data.user_id');

    $saved = $user->destinations()->sole();
    expect($saved->getAttributes())->not->toHaveKeys(['radius', 'source', 'parking_count']);
    expect($other->destinations()->count())->toBe(0);
    Http::assertNothingSent();
});

test('the saved destination list is private and ordered by label then identity', function () {
    $user = User::factory()->create();
    $last = Destination::factory()->for($user)->create(['label' => 'Zebra']);
    $first = Destination::factory()->for($user)->create(['label' => 'Alpha']);
    $second = Destination::factory()->for($user)->create(['label' => 'Alpha']);
    Destination::factory()->create(['label' => 'Another user']);

    $response = $this->actingAs($user)->getJson(route('profile.destinations.index'))
        ->assertOk()->assertJsonCount(3, 'data');
    expect(array_column($response->json('data'), 'id'))->toBe([$first->id, $second->id, $last->id]);
    expect($response->headers->get('Cache-Control'))->toContain('private', 'no-store');
});

test('a user can change only their personal label and remove a destination', function () {
    $user = User::factory()->create();
    $saved = Destination::factory()->for($user)->create(['label' => 'Office']);
    $this->actingAs($user)->patchJson(route('profile.destinations.update', $saved), [
        'label' => 'Grandma', 'latitude' => 0, 'name' => 'Changed',
    ])->assertOk()->assertJsonPath('data.label', 'Grandma')->assertJsonPath('data.destination.latitude', 52.36);
    expect($saved->fresh()->label)->toBe('Grandma');
    expect($saved->fresh()->name)->toBe($saved->name);
    $this->deleteJson(route('profile.destinations.destroy', $saved))->assertNoContent();
    $this->assertModelMissing($saved);
});

test('other accounts cannot rename or remove a saved destination', function () {
    $saved = Destination::factory()->create(['label' => 'Private']);
    $this->actingAs(User::factory()->create())
        ->patchJson(route('profile.destinations.update', $saved), ['label' => 'Stolen'])->assertForbidden();
    $this->deleteJson(route('profile.destinations.destroy', $saved))->assertForbidden();
    expect($saved->fresh()->label)->toBe('Private');
});

test('saved destination endpoints require a signed in verified account', function () {
    $saved = Destination::factory()->create();
    foreach ([null, User::factory()->unverified()->create()] as $user) {
        if ($user) {
            $this->actingAs($user);
        }
        $status = $user ? 403 : 401;
        $this->getJson(route('profile.destinations.index'))->assertStatus($status);
        $this->postJson(route('profile.destinations.store'), destinationPayload())->assertStatus($status);
        $this->patchJson(route('profile.destinations.update', $saved), ['label' => 'Changed'])->assertStatus($status);
        $this->deleteJson(route('profile.destinations.destroy', $saved))->assertStatus($status);
    }
    expect(Destination::count())->toBe(1);
});

test('saving validates identity coordinates label and area bounds', function (string $field, mixed $value) {
    $payload = destinationPayload();
    data_set($payload, $field, $value);
    $this->actingAs(User::factory()->create())
        ->postJson(route('profile.destinations.store'), $payload)
        ->assertUnprocessable()->assertJsonValidationErrors($field);
    expect(Destination::count())->toBe(0);
})->with([
    ['label', '   '], ['label', str_repeat('a', 101)], ['key', ''], ['name', ''], ['type', ''],
    ['latitude', 90.1], ['longitude', -180.1], ['latitude', 'NaN'],
    ['bounds.north', 52.34], ['bounds.east', 4.86], ['bounds.south', -91], ['bounds', ['north' => 53, 'unknown' => true]],
]);

test('renaming rejects empty or overlong labels', function (string $label) {
    $user = User::factory()->create();
    $saved = Destination::factory()->for($user)->create(['label' => 'Original']);
    $this->actingAs($user)->patchJson(route('profile.destinations.update', $saved), ['label' => $label])
        ->assertUnprocessable()->assertJsonValidationErrors('label');
    expect($saved->fresh()->label)->toBe('Original');
})->with(['   ', str_repeat('a', 101)]);

test('a coordinate destination without provider details can be saved and reopened', function () {
    $this->actingAs(User::factory()->create())->postJson(route('profile.destinations.store'), [
        'label' => 'Grandma', 'key' => 'url:destination', 'name' => 'A selected location',
        'type' => 'destination', 'latitude' => -33.9, 'longitude' => 18.4,
    ])->assertCreated();
    $this->getJson(route('profile.destinations.index'))->assertOk()
        ->assertJsonPath('data.0.destination.latitude', -33.9)
        ->assertJsonPath('data.0.destination.longitude', 18.4)
        ->assertJsonPath('data.0.destination.sub', null)
        ->assertJsonMissingPath('data.0.destination.bounds');
});

test('account deletion removes saved destinations', function () {
    $saved = Destination::factory()->create();
    $saved->user->delete();
    $this->assertModelMissing($saved);
});
