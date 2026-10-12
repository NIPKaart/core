<?php

use App\Enums\UserRole;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\Favorite;
use App\Models\ParkingOffstreet;
use App\Models\User;
use App\Services\DatasetDeliveryStorage;
use App\Services\OffstreetImportService;
use App\Services\OffstreetObservationService;
use App\Support\OffstreetObservations;
use Aws\MockHandler;
use Aws\Result;
use Aws\S3\S3Client;
use Database\Factories\DatasetSourceFactory;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

function identityReviewer(): User
{
    $user = User::factory()->create();
    $user->assignRole(UserRole::ADMIN);

    return $user;
}

function identityRecord(string $id, string $name = 'Garage A', array $point = [4.88, 52.36]): array
{
    return ['external_id' => $id, 'name' => $name, 'source_name' => $name, 'facility_type' => 'garage', 'geometry' => ['type' => 'Point', 'coordinates' => $point]];
}

function identityCatalog(array $records, User $user): DatasetImport
{
    return app(OffstreetImportService::class)->intake(json_encode([
        'format' => 'nipkaart-offstreet-catalog-3', 'dataset' => 'nl-amsterdam-garages', 'source' => DatasetSourceFactory::offstreetDescription(),
        'delivery_id' => (string) Str::uuid(), 'retrieved_at' => now()->subMinute()->utc()->format('Y-m-d\TH:i:s.u\Z'),
        'selection' => 'car-garages-and-pr', 'complete' => true, 'source_count' => count($records), 'records' => $records,
    ], JSON_THROW_ON_ERROR), $user);
}

function identityPublish(DatasetImport $import, User $user): void
{
    $service = app(OffstreetImportService::class);
    $service->decide($import, $user, 'publish', null, $service->review($import)['token']);
}

it('retains facility IDs and favorites through repeated complete source ID replacement', function () {
    $this->freezeTime();
    $source = DatasetSource::factory()->offstreet()->create();
    $user = identityReviewer();
    identityPublish(identityCatalog([identityRecord('100'), identityRecord('101', 'Garage B', [4.94, 52.32])], $user), $user);
    $garage = ParkingOffstreet::where('name', 'Garage A')->sole();
    $favorite = Favorite::create(['user_id' => $user->id, 'favoritable_type' => $garage->getMorphClass(), 'favoritable_id' => $garage->id]);
    $garage->forceFill(['visibility' => false, 'capacity' => 400, 'free_space' => 12])->save();

    $this->travel(5)->minutes();
    $import = identityCatalog([identityRecord('200'), identityRecord('201', 'Garage B', [4.94, 52.32])], $user);
    $review = app(OffstreetImportService::class)->review($import);
    expect($review['counts'])->toMatchArray(['new' => 0, 'missing' => 0, 'conflict' => 0, 'changed' => 2]);
    identityPublish($import, $user);
    $this->travel(5)->minutes();
    identityPublish(identityCatalog([identityRecord('300'), identityRecord('301', 'Garage B', [4.94, 52.32])], $user), $user);

    $this->assertDatabaseCount('parking_offstreet_spaces', 2);
    expect($garage->fresh())->source_record->external_id->toBe('300')->visibility->toBeFalse()->capacity->toBe(400)->free_space->toBe(12);
    expect($favorite->fresh()->favoritable_id)->toBe($garage->id);
    expect($source->fresh()->requires_identity_context)->toBeTrue();
    expect($import->fresh()->identity_resolution[0])->toMatchArray(['facility_id' => $garage->id, 'method' => 'name_type_location']);
});

it('registers missing deliveries without removing facilities and recognizes a returning facility', function () {
    $this->freezeTime();
    DatasetSource::factory()->offstreet()->create();
    $user = identityReviewer();
    identityPublish(identityCatalog([identityRecord('100')], $user), $user);
    $garage = ParkingOffstreet::sole();
    $this->travel(5)->minutes();
    identityPublish(identityCatalog([], $user), $user);
    $missingSince = $garage->fresh()->missing_since;
    $this->travel(5)->minutes();
    identityPublish(identityCatalog([], $user), $user);
    expect($garage->fresh())->visibility->toBeTrue()->consecutive_missing_deliveries->toBe(2)->missing_since->toEqual($missingSince);

    $this->travel(5)->minutes();
    identityPublish(identityCatalog([identityRecord('200')], $user), $user);

    expect(ParkingOffstreet::sole())->id->toBe($garage->id)->missing_since->toBeNull()->consecutive_missing_deliveries->toBe(0);
});

it('requires attributable review for ambiguous nearby candidates and rejects stale decisions', function () {
    $this->freezeTime();
    DatasetSource::factory()->offstreet()->create();
    $user = identityReviewer();
    identityPublish(identityCatalog([identityRecord('100'), identityRecord('101', 'Garage B', [4.8801, 52.36])], $user), $user);
    $garage = ParkingOffstreet::where('name', 'Garage A')->sole();
    $this->travel(5)->minutes();
    $import = identityCatalog([identityRecord('200')], $user);
    $service = app(OffstreetImportService::class);
    $review = $service->review($import);
    expect($review['rows'][0]['identity']['method'])->toBe('review');
    expect(fn () => identityPublish($import, $user))->toThrow(ValidationException::class);

    $this->actingAs($user)->patch(route('app.imports.update', $import), [
        'decision' => 'resolve_identity', 'external_id' => '200', 'facility_id' => $garage->id,
        'reason' => 'Source address and garage entrance confirmed.', 'review_token' => $review['token'],
    ])->assertRedirect();
    expect(fn () => $service->resolveIdentity($import, $user, '200', null, 'Wrong new facility', $review['token']))->toThrow(ValidationException::class);
    identityPublish($import->fresh(), $user);

    $decision = $import->fresh()->identity_resolution[0]['decision'];
    expect($decision)->toMatchArray(['actor_id' => $user->id, 'facility_id' => $garage->id, 'reason' => 'Source address and garage entrance confirmed.']);
    $this->assertDatabaseCount('parking_offstreet_spaces', 2);
});

it('does not reuse an ID for a distant facility and retains both physical identities after review', function () {
    $this->freezeTime();
    DatasetSource::factory()->offstreet()->create();
    $user = identityReviewer();
    identityPublish(identityCatalog([identityRecord('100')], $user), $user);
    $original = ParkingOffstreet::sole();
    $this->travel(5)->minutes();
    $import = identityCatalog([identityRecord('100', 'Different garage', [4.94, 52.32])], $user);
    $service = app(OffstreetImportService::class);
    expect($service->review($import)['rows'][0]['identity']['method'])->toBe('review');
    $service->resolveIdentity($import, $user, '100', null, 'This is a distinct facility.', $service->review($import)['token']);
    identityPublish($import->fresh(), $user);

    $this->assertDatabaseCount('parking_offstreet_spaces', 2);
    expect($original->fresh()->name)->toBe('Garage A');
    expect(ParkingOffstreet::where('name', 'Different garage')->sole()->id)->not->toBe($original->id);
});

it('blocks two source records from resolving to one facility', function () {
    $this->freezeTime();
    DatasetSource::factory()->offstreet()->create();
    $user = identityReviewer();
    identityPublish(identityCatalog([identityRecord('100')], $user), $user);
    $this->travel(5)->minutes();
    $import = identityCatalog([identityRecord('200'), identityRecord('201')], $user);

    expect(fn () => identityPublish($import, $user))->toThrow(ValidationException::class);
    expect(ParkingOffstreet::count())->toBe(1);
});

it('rejects identity decisions outside the dataset or from an unauthorized reviewer', function () {
    DatasetSource::factory()->offstreet()->create();
    $user = identityReviewer();
    $import = identityCatalog([identityRecord('100')], $user);
    $other = ParkingOffstreet::factory()->create();
    $token = app(OffstreetImportService::class)->review($import)['token'];

    $this->actingAs(User::factory()->create())->patch(route('app.imports.update', $import), [
        'decision' => 'resolve_identity', 'external_id' => '100', 'facility_id' => $other->id, 'reason' => 'Test', 'review_token' => $token,
    ])->assertForbidden();
    $this->actingAs($user)->patch(route('app.imports.update', $import), [
        'decision' => 'resolve_identity', 'external_id' => '100', 'facility_id' => $other->id, 'reason' => 'Test', 'review_token' => $token,
    ])->assertSessionHasErrors('identity');
    expect($import->fresh()->identity_decisions)->toBeNull();
});

/** Read a versioned observation through the actual storage/ingest path. */
function identityObservations(array $overrides): array
{
    config(['dataset-deliveries.enabled' => true, 'filesystems.disks.dataset-deliveries.bucket' => 'identity-test']);
    $json = json_encode([
        'format' => 'nipkaart-offstreet-observations-3', 'dataset' => 'nl-amsterdam-garages', 'selection' => 'car-garages-and-pr',
        'delivery_id' => (string) Str::uuid(), 'fetched_at' => now()->utc()->format('Y-m-d\TH:i:s\Z'), 'source_count' => 1,
        'records' => [['external_id' => '100', 'observed_at' => now()->subSeconds(30)->utc()->format('Y-m-d\TH:i:s\Z'),
            'source_state' => 'ok', 'status' => 'counting', 'capacity' => 400, 'available' => 23]],
        ...$overrides,
    ], JSON_THROW_ON_ERROR);
    $handler = new MockHandler;
    $handler->append(new Result(['Contents' => [['Key' => 'offstreet-observations/nl-amsterdam-garages/20261011T000000Z-'.Str::uuid().'.json', 'ETag' => '"etag"']], 'IsTruncated' => false]));
    $handler->append(new Result(['Body' => Utils::streamFor($json), 'ContentLength' => strlen($json), 'Metadata' => ['sha256' => hash('sha256', $json)]]));
    $client = new S3Client(['version' => 'latest', 'region' => 'auto', 'credentials' => ['key' => 'test', 'secret' => 'test'], 'handler' => $handler, 'retries' => 0]);
    app()->instance(DatasetDeliveryStorage::class, new DatasetDeliveryStorage($client));

    return app(OffstreetObservationService::class)->ingest();
}

it('resolves reused observation IDs through their immutable catalog version', function () {
    $this->freezeTime();
    DatasetSource::factory()->offstreet()->create();
    $user = identityReviewer();
    $first = identityCatalog([identityRecord('100')], $user);
    identityPublish($first, $user);
    $original = ParkingOffstreet::sole();
    $this->travel(5)->minutes();
    $second = identityCatalog([identityRecord('100', 'Different garage', [4.94, 52.32])], $user);
    $service = app(OffstreetImportService::class);
    $service->resolveIdentity($second, $user, '100', null, 'Different physical facility.', $service->review($second)['token']);
    identityPublish($second->fresh(), $user);
    $replacement = ParkingOffstreet::where('name', 'Different garage')->sole();

    expect(identityObservations(['catalog_delivery_id' => $first->delivery_id]))->toBe(['nl-amsterdam-garages' => ['applied' => 1, 'unknown' => 0]]);
    expect($original->fresh()->free_space)->toBe(23);
    expect($replacement->fresh()->free_space)->toBeNull();
    $this->travel(1)->minutes();
    expect(identityObservations(['catalog_delivery_id' => $second->delivery_id]))->toBe(['nl-amsterdam-garages' => ['applied' => 1, 'unknown' => 0]]);
    expect($replacement->fresh()->free_space)->toBe(23);
});

it('refuses unversioned observations after renumbering and retries a pending catalog reference', function () {
    $this->freezeTime();
    $source = DatasetSource::factory()->offstreet()->create();
    $user = identityReviewer();
    identityPublish(identityCatalog([identityRecord('100')], $user), $user);
    $this->travel(5)->minutes();
    $second = identityCatalog([identityRecord('200')], $user);
    identityPublish($second, $user);

    expect(identityObservations(['format' => 'nipkaart-offstreet-observations-2']))->toBe(['nl-amsterdam-garages' => ['applied' => 0, 'unknown' => 1]]);
    $cursor = $source->fresh()->last_observation_key;
    $this->travel(5)->minutes();
    $pending = identityCatalog([identityRecord('300')], $user);
    expect(identityObservations(['catalog_delivery_id' => $pending->delivery_id]))->toBe(['nl-amsterdam-garages' => ['applied' => 0, 'unknown' => 1]]);
    expect($source->fresh()->last_observation_key)->toBe($cursor);
    expect(ParkingOffstreet::sole()->free_space)->toBeNull();
});

it('rejects observations without a valid catalog reference in version three', function (array $overrides) {
    expect(fn () => app(OffstreetObservations::class)->decode(json_encode([
        'format' => 'nipkaart-offstreet-observations-3', 'dataset' => 'nl-amsterdam-garages', 'selection' => 'car-garages-and-pr',
        'delivery_id' => (string) Str::uuid(), 'fetched_at' => now()->utc()->format('Y-m-d\TH:i:s\Z'), 'source_count' => 1,
        'records' => [['external_id' => '100', 'observed_at' => null, 'source_state' => null, 'status' => null, 'capacity' => null, 'available' => null]],
        ...$overrides,
    ], JSON_THROW_ON_ERROR)))->toThrow(ValidationException::class);
})->with(['missing reference' => [[]], 'invalid reference' => [['catalog_delivery_id' => 'not-a-uuid']]]);

it('requires review when a nearby reused source ID has a different name', function () {
    $this->freezeTime();
    DatasetSource::factory()->offstreet()->create();
    $user = identityReviewer();
    identityPublish(identityCatalog([identityRecord('100')], $user), $user);
    $this->travel(5)->minutes();
    $import = identityCatalog([identityRecord('100', 'Another garage', [4.8801, 52.36])], $user);

    expect(app(OffstreetImportService::class)->review($import)['rows'][0]['identity']['method'])->toBe('review');
    expect(fn () => identityPublish($import, $user))->toThrow(ValidationException::class);
    expect(ParkingOffstreet::sole()->name)->toBe('Garage A');
});

it('creates a separate distant facility without changing existing identities', function () {
    $this->freezeTime();
    DatasetSource::factory()->offstreet()->create();
    $user = identityReviewer();
    identityPublish(identityCatalog([identityRecord('100')], $user), $user);
    $original = ParkingOffstreet::sole();
    $this->travel(5)->minutes();
    $import = identityCatalog([identityRecord('100'), identityRecord('200', 'New garage', [4.94, 52.32])], $user);

    expect(app(OffstreetImportService::class)->review($import)['counts'])->toMatchArray(['new' => 1, 'unchanged' => 1, 'missing' => 0]);
    identityPublish($import, $user);

    $this->assertDatabaseCount('parking_offstreet_spaces', 2);
    expect(ParkingOffstreet::where('name', 'Garage A')->sole()->id)->toBe($original->id);
});

it('recognizes rotating live IDs from same-fetch claims without creating a catalog review per refresh', function () {
    $this->freezeTime();
    DatasetSource::factory()->offstreet()->create();
    $user = identityReviewer();
    identityPublish(identityCatalog([identityRecord('100')], $user), $user);
    $garage = ParkingOffstreet::sole();
    $originalSource = $garage->source_record;
    $this->travel(5)->minutes();
    $record = ['external_id' => '200', 'observed_at' => now()->subSeconds(30)->utc()->format('Y-m-d\TH:i:s\Z'),
        'source_state' => 'ok', 'status' => 'counting', 'capacity' => 400, 'available' => 17];

    expect(identityObservations(['identity_records' => [identityRecord('200')], 'records' => [$record]]))->toBe(['nl-amsterdam-garages' => ['applied' => 1, 'unknown' => 0]]);

    $this->assertDatabaseCount('dataset_imports', 1);
    $this->assertDatabaseCount('parking_offstreet_spaces', 1);
    expect($garage->fresh())->free_space->toBe(17)->source_record->toBe($originalSource);
    expect($garage->fresh()->observation_identity['source_record']['external_id'])->toBe('200');
});

it('does not attach unknown or ambiguous live claims and never creates facilities from them', function () {
    $this->freezeTime();
    DatasetSource::factory()->offstreet()->create();
    $user = identityReviewer();
    identityPublish(identityCatalog([identityRecord('100'), identityRecord('101', 'Garage B', [4.8801, 52.36])], $user), $user);
    $this->travel(5)->minutes();

    expect(identityObservations(['identity_records' => [identityRecord('100')]]))->toBe(['nl-amsterdam-garages' => ['applied' => 0, 'unknown' => 1]]);
    expect(identityObservations(['identity_records' => [identityRecord('100', 'New site', [4.94, 52.32])]]))->toBe(['nl-amsterdam-garages' => ['applied' => 0, 'unknown' => 1]]);
    $this->assertDatabaseCount('dataset_imports', 1);
    $this->assertDatabaseCount('parking_offstreet_spaces', 2);
    expect(ParkingOffstreet::whereNotNull('free_space')->count())->toBe(0);
});

it('rejects mismatched or invalid live identity claims before applying occupancy', function (array $claims) {
    $this->freezeTime();
    $source = DatasetSource::factory()->offstreet()->create();
    $user = identityReviewer();
    identityPublish(identityCatalog([identityRecord('100')], $user), $user);

    expect(identityObservations(['identity_records' => $claims]))->toBe(['nl-amsterdam-garages' => null]);
    expect(ParkingOffstreet::sole()->free_space)->toBeNull();
    expect($source->fresh()->last_observation_key)->not->toBeNull();
})->with([
    'other source ID' => [[identityRecord('200')]],
    'outside bounds' => [[identityRecord('100', point: [10, 60])]],
    'duplicate claim' => [[identityRecord('100'), identityRecord('100')]],
]);
