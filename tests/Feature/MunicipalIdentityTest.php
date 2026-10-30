<?php

use App\Enums\UserRole;
use App\Models\DatasetSource;
use App\Models\Favorite;
use App\Models\ParkingMunicipal;
use App\Models\User;
use App\Services\MunicipalIdentityService;
use App\Services\MunicipalImportService;
use Database\Factories\DatasetSourceFactory;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

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

it('bounds legacy identity lookup work while preserving each retained location', function () {
    $source = DatasetSource::factory()->create();
    $user = identityMunicipalReviewer();
    $records = array_map(fn (int $index): array => identityMunicipalRecord('legacy-'.$index, 4.9 + $index * 0.001), range(0, 3));
    $spaces = collect($records)->map(function (array $record) use ($source): ParkingMunicipal {
        $space = ParkingMunicipal::factory()->recycle($source->municipality)->create([
            'dataset_source_id' => $source->id, 'external_id' => $record['external_id'], 'source_record' => $record,
        ]);
        $tracked = new class extends ParkingMunicipal
        {
            public int $sourceIdReads = 0;

            public function getAttribute(mixed $key): mixed
            {
                if ($key === 'external_id') {
                    $this->sourceIdReads++;
                }

                return parent::getAttribute($key);
            }
        };

        return $tracked->setRawAttributes($space->getAttributes(), true);
    })->keyBy('id');
    $import = app(MunicipalImportService::class)->intake(json_encode(identityMunicipalDelivery($records), JSON_THROW_ON_ERROR), $user);

    $identities = app(MunicipalIdentityService::class)->resolve($import, $spaces);

    expect(array_column($identities, 'facility_id'))->toBe($spaces->keys()->all());
    expect(array_column($identities, 'method'))->toBe(array_fill(0, 4, 'source_id'));
    expect($spaces->sum('sourceIdReads'))->toBeLessThanOrEqual($spaces->count() * 2);
});

it('retains nearby candidates across latitude bands and distant source IDs without duplicate candidates', function () {
    $source = DatasetSource::factory()->create();
    $user = identityMunicipalReviewer();
    $createSpace = function (string $externalId, string $claimId, float $longitude, float $latitude) use ($source): ParkingMunicipal {
        $record = identityMunicipalRecord($claimId, $longitude);
        $record['geometry']['coordinates'][1] = $latitude;

        return ParkingMunicipal::factory()->recycle($source->municipality)->create([
            'dataset_source_id' => $source->id, 'external_id' => $externalId, 'source_record' => $record,
            'longitude' => $longitude, 'latitude' => $latitude,
        ]);
    };
    $near = $createSpace('same', 'same', 4.9, 52.30099);
    $distant = $createSpace('same', 'same', 4.92, 52.31);
    $alias = $createSpace('old-id', 'same', 4.94, 52.4);
    $createSpace('outside-radius', 'outside-radius', 4.9, 52.3025);
    $incoming = identityMunicipalRecord('same');
    $incoming['geometry']['coordinates'][1] = 52.30101;
    $service = app(MunicipalImportService::class);
    $import = $service->intake(json_encode(identityMunicipalDelivery([$incoming]), JSON_THROW_ON_ERROR), $user);

    $identity = $service->review($import)['identities'][0];

    expect($identity['method'])->toBe('review');
    expect(array_column($identity['candidates'], 'id'))->toBe([$near->id, $distant->id, $alias->id]);
    expect($identity['candidates'][0]['distance_metres'])->toBeLessThan(3);
});

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

/** Minimal GeoJSON evidence retaining Stockholm's regulation context and rotating feature identifiers. */
function identityMunicipalFeatureRecord(int $featureId, string $citation): array
{
    $record = identityMunicipalRecord('LTFR_P_RORELSEHINDRADE.'.$featureId);
    $record['source_attributes'] = [
        'type' => 'Feature', 'id' => $record['external_id'], 'geometry' => $record['geometry'],
        'properties' => ['FID' => $featureId, 'EXTENT_NO' => 8499, 'CITATION' => $citation],
    ];

    return $record;
}

it('retains distinct municipal identities when coincident regulations swap and replace their feature IDs', function () {
    $this->freezeTime();
    DatasetSource::factory()->create();
    $user = identityMunicipalReviewer();
    $service = app(MunicipalImportService::class);
    $first = $service->intake(json_encode(identityMunicipalDelivery([
        identityMunicipalFeatureRecord(1, '0180 2019-04459'), identityMunicipalFeatureRecord(2, '0180 2020-01573'),
    ]), JSON_THROW_ON_ERROR), $user);
    $service->decide($first, $user, 'publish', null, $service->review($first)['token']);
    $original = ParkingMunicipal::where('external_id', 'LTFR_P_RORELSEHINDRADE.1')->sole();
    $other = ParkingMunicipal::where('external_id', 'LTFR_P_RORELSEHINDRADE.2')->sole();
    $original->update(['visibility' => false]);
    $favorite = Favorite::factory()->for($user)->create(['favoritable_type' => $original->getMorphClass(), 'favoritable_id' => $original->id]);

    foreach ([[2, 1], [100, 101]] as [$firstId, $secondId]) {
        $this->travel(5)->minutes();
        $import = $service->intake(json_encode(identityMunicipalDelivery([
            identityMunicipalFeatureRecord($firstId, '0180 2019-04459'), identityMunicipalFeatureRecord($secondId, '0180 2020-01573'),
        ]), JSON_THROW_ON_ERROR), $user);
        $review = $service->review($import);

        expect($review['counts'])->toMatchArray(['new' => 0, 'missing' => 0, 'conflict' => 0]);
        expect($review['identities'][0])->toMatchArray(['facility_id' => $original->id, 'method' => 'source_context']);
        expect($review['identities'][1])->toMatchArray(['facility_id' => $other->id, 'method' => 'source_context']);
        $service->decide($import, $user, 'publish', null, $review['token']);
    }

    $this->assertDatabaseCount('parking_municipal_spaces', 2);
    expect($original->fresh())->visibility->toBeFalse()->source_record->external_id->toBe('LTFR_P_RORELSEHINDRADE.100');
    expect($other->fresh()->source_record['source_attributes']['properties']['CITATION'])->toBe('0180 2020-01573');
    expect($favorite->fresh()->favoritable_id)->toBe($original->id);
    expect($first->fresh()->identity_resolution[0]['external_id'])->toBe('LTFR_P_RORELSEHINDRADE.1');
});

it('requires municipal review when coincident claims have no unique verified source context', function (string $case) {
    $this->freezeTime();
    DatasetSource::factory()->create();
    $user = identityMunicipalReviewer();
    $service = app(MunicipalImportService::class);
    $records = [
        identityMunicipalFeatureRecord(1, '0180 2019-04459'),
        identityMunicipalFeatureRecord(2, $case === 'duplicate claims' ? '0180 2019-04459' : '0180 2020-01573'),
    ];
    if ($case === 'missing context') {
        $records[0]['source_attributes'] = new stdClass;
    }
    $first = $service->intake(json_encode(identityMunicipalDelivery($records), JSON_THROW_ON_ERROR), $user);
    $service->decide($first, $user, 'publish', null, $service->review($first)['token']);
    $this->travel(5)->minutes();
    $record = identityMunicipalFeatureRecord(3, '0180 2019-04459');
    if ($case === 'changed context') {
        $record['source_attributes']['properties']['CITATION'] = '0180 2025-01234';
    } elseif ($case === 'unverified feature ID') {
        $record['source_attributes']['id'] = 'another-feature';
    } elseif ($case === 'unverified FID') {
        $record['source_attributes']['properties']['FID'] = 999;
    } elseif ($case === 'missing context') {
        $record['source_attributes'] = new stdClass;
    }
    $import = $service->intake(json_encode(identityMunicipalDelivery([$record]), JSON_THROW_ON_ERROR), $user);
    $review = $service->review($import);

    expect($review['identities'][0]['method'])->toBe('review');
    expect(fn () => $service->decide($import, $user, 'publish', null, $review['token']))->toThrow(ValidationException::class);
    $this->assertDatabaseCount('parking_municipal_spaces', 2);
    expect($import->fresh()->state)->toBe('pending');
})->with(['duplicate claims', 'changed context', 'unverified feature ID', 'unverified FID', 'missing context']);

it('shows only uncertain identity tasks with source evidence from the same dataset', function () {
    $this->freezeTime();
    DatasetSource::factory()->create();
    $user = identityMunicipalReviewer();
    $service = app(MunicipalImportService::class);
    $first = $service->intake(json_encode(identityMunicipalDelivery([identityMunicipalRecord('a'), identityMunicipalRecord('b')]), JSON_THROW_ON_ERROR), $user);
    $service->decide($first, $user, 'publish', null, $service->review($first)['token']);
    $this->travel(5)->minutes();
    $second = $service->intake(json_encode(identityMunicipalDelivery([identityMunicipalRecord('c')]), JSON_THROW_ON_ERROR), $user);

    $this->actingAs($user)->get(route('app.imports.show', [$second, 'filter' => 'identity']))->assertInertia(fn (Assert $page) => $page
        ->where('filters.filter', 'identity')->where('review.identity_count', 1)->has('review.rows', 1)
        ->where('review.rows.0.external_id', 'c')->has('review.rows.0.identity.candidates', 2)
        ->where('review.rows.0.identity.candidates.0.source.geometry.type', 'Point')
        ->where('review.rows.0.identity.candidates.0.source.street', 'Teststraat'));
    $this->get(route('app.imports.show', [$second, 'filter' => 'identity', 'q' => 'no-match']))->assertInertia(fn (Assert $page) => $page
        ->has('review.rows', 0)->where('review.identity_count', 1));
});
