<?php

use App\Enums\UserRole;
use App\Models\DatasetSource;
use App\Models\Favorite;
use App\Models\ParkingMunicipal;
use App\Models\User;
use App\Services\MunicipalImportService;
use Database\Factories\DatasetSourceFactory;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

function identityMunicipalDelivery(array $records): array
{
    return [
        'format' => 'nipkaart-municipal-2', 'dataset' => 'nl-amsterdam', 'source' => DatasetSourceFactory::municipalDescription(),
        'delivery_id' => (string) Str::uuid(), 'retrieved_at' => now()->subMinute()->utc()->format('Y-m-d\TH:i:s.u\Z'),
        'selection' => 'e6a-all', 'complete' => true, 'source_count' => count($records), 'records' => $records,
    ];
}

function identityMunicipalRecord(string $id, float $longitude = 4.9): array
{
    return [
        'external_id' => $id, 'geometry' => ['type' => 'Point', 'coordinates' => [$longitude, 52.3]],
        'number' => null, 'street' => 'Teststraat', 'access_category' => 'general', 'orientation' => null,
        'source_attributes' => ['TYPE' => 'gehandicapten algemeen'], 'source_updated_at' => null,
    ];
}

function identityMunicipalReviewer(): User
{
    $user = User::factory()->create();
    $user->assignRole(UserRole::ADMIN);

    return $user;
}

it('retains municipal UUIDs favorites visibility and immutable resolutions across changing source IDs', function () {
    $this->freezeTime();
    DatasetSource::factory()->create();
    $user = identityMunicipalReviewer();
    $service = app(MunicipalImportService::class);
    $first = $service->intake(json_encode(identityMunicipalDelivery([identityMunicipalRecord('old')]), JSON_THROW_ON_ERROR), $user);
    $service->decide($first, $user, 'publish', null, $service->review($first)['token']);
    $space = ParkingMunicipal::sole();
    $space->update(['visibility' => false]);
    $favorite = Favorite::factory()->for($user)->create(['favoritable_type' => (new ParkingMunicipal)->getMorphClass(), 'favoritable_id' => $space->id]);
    $this->travel(5)->minutes();
    $second = $service->intake(json_encode(identityMunicipalDelivery([identityMunicipalRecord('new')]), JSON_THROW_ON_ERROR), $user);
    $review = $service->review($second);

    expect($review['counts'])->toMatchArray(['new' => 0, 'missing' => 0, 'changed' => 1, 'conflict' => 0]);
    expect($review['identities'][0])->toMatchArray(['method' => 'geometry', 'facility_id' => $space->id]);
    $service->decide($second, $user, 'publish', null, $review['token']);

    $this->assertDatabaseCount('parking_municipal_spaces', 1);
    expect($space->fresh())->id->toBe($space->id)->visibility->toBeFalse();
    expect($space->fresh()->source_record['external_id'])->toBe('new');
    expect($favorite->fresh()->favoritable_id)->toBe($space->id);
    expect($first->fresh()->identity_resolution[0]['external_id'])->toBe('old');
    expect($second->fresh()->identity_resolution[0]['facility_id'])->toBe($space->id);
});

it('requires an attributable decision for ambiguous adjacent municipal records and refuses stale decisions', function () {
    $this->freezeTime();
    DatasetSource::factory()->create();
    $user = identityMunicipalReviewer();
    $service = app(MunicipalImportService::class);
    $first = $service->intake(json_encode(identityMunicipalDelivery([identityMunicipalRecord('a'), identityMunicipalRecord('b')]), JSON_THROW_ON_ERROR), $user);
    $service->decide($first, $user, 'publish', null, $service->review($first)['token']);
    $this->travel(5)->minutes();
    $second = $service->intake(json_encode(identityMunicipalDelivery([identityMunicipalRecord('c')]), JSON_THROW_ON_ERROR), $user);
    $review = $service->review($second);

    expect($review['identities'][0]['method'])->toBe('review');
    expect(fn () => $service->decide($second, $user, 'publish', null, $review['token']))->toThrow(ValidationException::class);
    $space = ParkingMunicipal::where('external_id', 'a')->sole();
    $this->actingAs($user)->patch(route('app.imports.update', $second), [
        'decision' => 'resolve_identity', 'external_id' => 'c', 'facility_id' => $space->id,
        'reason' => 'Brongeometrie en bebording expliciet beoordeeld.', 'review_token' => $review['token'],
    ])->assertSessionHasNoErrors()->assertRedirect();
    expect($second->fresh()->identity_decisions[hash('sha256', 'c')]['actor_id'])->toBe($user->id);
    expect(fn () => $service->resolveIdentity($second->fresh(), $user, 'c', null, 'New decision', $review['token']))->toThrow(ValidationException::class);
    $review = $service->review($second->fresh());
    $service->decide($second->fresh(), $user, 'publish', null, $review['token']);
    expect($space->fresh()->source_record['external_id'])->toBe('c');
    $this->assertDatabaseCount('parking_municipal_spaces', 2);
});

it('does not assign two incoming municipal claims to one retained UUID', function () {
    $this->freezeTime();
    DatasetSource::factory()->create();
    $user = identityMunicipalReviewer();
    $service = app(MunicipalImportService::class);
    $first = $service->intake(json_encode(identityMunicipalDelivery([identityMunicipalRecord('old')]), JSON_THROW_ON_ERROR), $user);
    $service->decide($first, $user, 'publish', null, $service->review($first)['token']);
    $this->travel(5)->minutes();
    $next = $service->intake(json_encode(identityMunicipalDelivery([identityMunicipalRecord('new1'), identityMunicipalRecord('new2')]), JSON_THROW_ON_ERROR), $user);

    expect(array_column($service->review($next)['identities'], 'method'))->toBe(['review', 'review']);
    expect(fn () => $service->decide($next, $user, 'publish', null, $service->review($next)['token']))->toThrow(ValidationException::class);
    $this->assertDatabaseCount('parking_municipal_spaces', 1);
});

it('holds reused IDs on a nearby different bay and rejects targets from another dataset', function () {
    $this->freezeTime();
    DatasetSource::factory()->create();
    $user = identityMunicipalReviewer();
    $service = app(MunicipalImportService::class);
    $first = $service->intake(json_encode(identityMunicipalDelivery([identityMunicipalRecord('same')]), JSON_THROW_ON_ERROR), $user);
    $service->decide($first, $user, 'publish', null, $service->review($first)['token']);
    $this->travel(5)->minutes();
    $next = $service->intake(json_encode(identityMunicipalDelivery([identityMunicipalRecord('same', 4.90001)]), JSON_THROW_ON_ERROR), $user);
    $review = $service->review($next);
    $other = ParkingMunicipal::factory()->create();

    expect($review['identities'][0]['method'])->toBe('review');
    expect(fn () => $service->resolveIdentity($next, $user, 'same', $other->id, 'Invalid cross-dataset link', $review['token']))->toThrow(ValidationException::class);
    expect($next->fresh()->identity_decisions)->toBeNull();
    $this->assertDatabaseCount('parking_municipal_spaces', 2);
});

it('requires administrator authorization and a reason for municipal identity decisions', function () {
    DatasetSource::factory()->create();
    $admin = identityMunicipalReviewer();
    $service = app(MunicipalImportService::class);
    $import = $service->intake(json_encode(identityMunicipalDelivery([identityMunicipalRecord('a')]), JSON_THROW_ON_ERROR), $admin);
    $review = $service->review($import);
    $data = ['decision' => 'resolve_identity', 'external_id' => 'a', 'facility_id' => null, 'review_token' => $review['token']];
    $user = User::factory()->create();
    $user->assignRole(UserRole::USER);

    $this->actingAs($user)->patch(route('app.imports.update', $import), [...$data, 'reason' => 'Not authorized'])->assertForbidden();
    $this->actingAs($admin)->patch(route('app.imports.update', $import), $data)->assertSessionHasErrors('reason');
    expect($import->fresh()->identity_decisions)->toBeNull();
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
});
