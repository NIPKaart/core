<?php

use App\Enums\ApiState;
use App\Enums\UserRole;
use App\Jobs\ProcessDatasetDelivery;
use App\Models\DatasetDelivery;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\Favorite;
use App\Models\ParkingOffstreet;
use App\Models\User;
use App\Services\DatasetDeliveryService;
use App\Services\DatasetDeliveryStorage;
use App\Services\OffstreetImportService;
use Aws\MockHandler;
use Aws\Result;
use Aws\S3\S3Client;
use Database\Factories\DatasetSourceFactory;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

function offstreetReviewer(): User
{
    $user = User::factory()->create();
    $user->assignRole(UserRole::ADMIN);

    return $user;
}

/** Two facilities taken from a real Amsterdam catalog delivery; unknown capacity stays null. */
function offstreetCatalog(array $overrides = [], ?array $records = null): array
{
    $records ??= [
        [
            'external_id' => '06757815-834C-0E44-42B0-AE4FC4AF9CEF', 'name' => 'Byzantium', 'source_name' => 'P-106_ Byzantium (opendata)',
            'facility_type' => 'garage', 'geometry' => ['type' => 'Point', 'coordinates' => [4.88001, 52.3619]],
            'short_capacity' => 446, 'long_capacity' => null, 'accessible_capacity' => null,
        ],
        [
            'external_id' => 'P+R-ARENA', 'name' => 'P+R ArenA', 'source_name' => 'P+R ArenA',
            'facility_type' => 'park_and_ride', 'geometry' => ['type' => 'Point', 'coordinates' => [4.94105, 52.31409]],
            'short_capacity' => null, 'long_capacity' => null, 'accessible_capacity' => null,
        ],
    ];

    return array_replace([
        'format' => 'nipkaart-offstreet-catalog-2', 'dataset' => 'nl-amsterdam-garages', 'source' => DatasetSourceFactory::offstreetDescription(),
        'delivery_id' => (string) Str::uuid(), 'retrieved_at' => now()->subMinute()->utc()->format('Y-m-d\TH:i:s.u\Z'),
        'selection' => 'car-garages-and-pr', 'complete' => true, 'source_count' => count($records), 'records' => $records,
    ], $overrides);
}

function stageOffstreet(array $data, User $user): DatasetImport
{
    return app(OffstreetImportService::class)->intake(json_encode($data, JSON_THROW_ON_ERROR), $user);
}

function publishOffstreet(DatasetImport $import, User $user): void
{
    $service = app(OffstreetImportService::class);
    $service->decide($import, $user, 'publish', null, $service->review($import)['token']);
}

it('stages an uploaded catalog through the shared import screens and publishes it after review', function () {
    $source = DatasetSource::factory()->offstreet()->create();
    $user = offstreetReviewer();
    $data = offstreetCatalog();

    $this->mock(DatasetDeliveryStorage::class)->shouldReceive('archive')->once();
    $this->actingAs($user)->post(route('app.imports.store'), ['file' => UploadedFile::fake()->createWithContent('catalog.json', json_encode($data))])->assertRedirect();
    $import = DatasetImport::sole();
    $this->assertDatabaseCount('parking_offstreet_spaces', 0);
    $this->get(route('app.imports.show', $import))->assertInertia(fn (Assert $page) => $page
        ->component('backend/imports/show')->where('dataset.target_type', 'offstreet')->where('review.counts.new', 2)->has('review.rows', 2));
    $token = app(OffstreetImportService::class)->review($import)['token'];
    $this->patch(route('app.imports.update', $import), ['decision' => 'publish', 'review_token' => $token])->assertRedirect();

    $garage = ParkingOffstreet::where('external_id', '06757815-834C-0E44-42B0-AE4FC4AF9CEF')->sole();
    expect($garage)->name->toBe('Byzantium')->parking_type->toBe('garage')->short_capacity->toBe(446)
        ->long_capacity->toBeNull()->accessible_capacity->toBeNull()->free_space_short->toBeNull()->api_state->toBeNull()
        ->municipality_id->toBe($source->municipality_id)->visibility->toBeTrue()->published_import_id->toBe($import->id);
    expect($garage->latitude)->toBe(52.3619)->and($garage->longitude)->toBe(4.88001);
    expect(ParkingOffstreet::where('external_id', 'P+R-ARENA')->sole())->parking_type->toBe('parkandride')->short_capacity->toBeNull();
    expect($import->fresh())->state->toBe('published');
});

it('updates changed facilities on reimport while keeping identity, visibility, favorites, live values and missing facilities', function () {
    DatasetSource::factory()->offstreet()->create();
    $user = offstreetReviewer();
    publishOffstreet(stageOffstreet(offstreetCatalog(), $user), $user);
    $garage = ParkingOffstreet::where('name', 'Byzantium')->sole();
    $garage->forceFill(['visibility' => false, 'free_space_short' => 12, 'api_state' => ApiState::OK])->save();
    $favorite = Favorite::create(['user_id' => $user->id, 'favoritable_type' => $garage->getMorphClass(), 'favoritable_id' => $garage->id]);

    $renamed = offstreetCatalog(records: [[...offstreetCatalog()['records'][0], 'name' => 'Byzantium garage', 'short_capacity' => 450]]);
    $import = stageOffstreet($renamed, $user);
    $review = app(OffstreetImportService::class)->review($import);
    expect($review['counts'])->toMatchArray(['changed' => 1, 'missing' => 1, 'new' => 0, 'conflict' => 0]);
    publishOffstreet($import, $user);

    expect($garage->fresh())->id->toBe($garage->id)->name->toBe('Byzantium garage')->short_capacity->toBe(450)
        ->visibility->toBeFalse()->free_space_short->toBe(12)->api_state->toBe(ApiState::OK)->published_import_id->toBe($import->id);
    expect($favorite->fresh())->not->toBeNull();
    expect(ParkingOffstreet::where('external_id', 'P+R-ARENA')->sole())->visibility->toBeTrue();
});

it('keeps manual corrections and blocks publication when the source changes the same field differently', function () {
    DatasetSource::factory()->offstreet()->create();
    $user = offstreetReviewer();
    publishOffstreet(stageOffstreet(offstreetCatalog(), $user), $user);
    ParkingOffstreet::where('name', 'Byzantium')->update(['name' => 'Garage Byzantium']);

    $unrelated = offstreetCatalog(records: [[...offstreetCatalog()['records'][0], 'short_capacity' => 460], offstreetCatalog()['records'][1]]);
    publishOffstreet(stageOffstreet($unrelated, $user), $user);
    expect(ParkingOffstreet::where('external_id', '06757815-834C-0E44-42B0-AE4FC4AF9CEF')->sole())->name->toBe('Garage Byzantium')->short_capacity->toBe(460);

    $conflicting = offstreetCatalog(records: [[...offstreetCatalog()['records'][0], 'name' => 'Byzantium Leidseplein', 'short_capacity' => 460], offstreetCatalog()['records'][1]]);
    $import = stageOffstreet($conflicting, $user);
    $review = app(OffstreetImportService::class)->review($import);
    expect($review['counts']['conflict'])->toBe(1)->and($review['blockers'])->not->toBeEmpty();
    expect(fn () => app(OffstreetImportService::class)->decide($import, $user, 'publish', null, $review['token']))->toThrow(ValidationException::class);
});

it('blocks a delivery that is not newer than the last published catalog', function () {
    DatasetSource::factory()->offstreet()->create();
    $user = offstreetReviewer();
    $older = stageOffstreet(offstreetCatalog(['retrieved_at' => now()->subHours(2)->utc()->format('Y-m-d\TH:i:s\Z')]), $user);
    publishOffstreet(stageOffstreet(offstreetCatalog(), $user), $user);

    expect(app(OffstreetImportService::class)->review($older)['blockers'])->toContain('Deze levering is niet nieuwer dan de laatst gepubliceerde levering.');
});

it('rejects catalogs that do not match the contract without staging anything', function (Closure $mutate) {
    DatasetSource::factory()->offstreet()->create();
    $data = offstreetCatalog();
    $mutate($data);

    expect(fn () => stageOffstreet($data, offstreetReviewer()))->toThrow(ValidationException::class);
    $this->assertDatabaseCount('dataset_imports', 0);
})->with([
    'municipal format' => [fn (&$data) => $data['format'] = 'nipkaart-municipal-pilot-1'],
    'other selection' => [fn (&$data) => $data['selection'] = 'all-garages'],
    'incomplete' => [fn (&$data) => $data['complete'] = false],
    'count mismatch' => [fn (&$data) => $data['source_count'] = 3],
    'extra live field' => [fn (&$data) => $data['records'][0]['free_space_short'] = 10],
    'missing field' => [function (&$data) {
        unset($data['records'][0]['accessible_capacity']);
    }],
    'unknown facility type' => [fn (&$data) => $data['records'][0]['facility_type'] = 'street'],
    'negative capacity' => [fn (&$data) => $data['records'][0]['short_capacity'] = -1],
    'boolean capacity' => [fn (&$data) => $data['records'][0]['long_capacity'] = true],
    'duplicate source id' => [fn (&$data) => $data['records'][1]['external_id'] = $data['records'][0]['external_id']],
    'blank name' => [fn (&$data) => $data['records'][0]['name'] = ' '],
    'polygon geometry' => [fn (&$data) => $data['records'][0]['geometry'] = ['type' => 'Polygon', 'coordinates' => [[[4.9, 52.3], [4.91, 52.3], [4.9, 52.3]]]]],
    'outside Amsterdam' => [fn (&$data) => $data['records'][0]['geometry']['coordinates'] = [5.12, 52.09]],
    'future retrieval' => [fn (&$data) => $data['retrieved_at'] = now()->addDay()->utc()->format('Y-m-d\TH:i:s\Z')],
]);

it('refuses a catalog addressed to a municipal dataset', function () {
    $municipal = DatasetSource::factory()->create();
    DatasetSource::factory()->offstreet()->create(['municipality_id' => $municipal->municipality_id]);

    expect(fn () => stageOffstreet(offstreetCatalog(['dataset' => 'nl-amsterdam']), offstreetReviewer()))->toThrow(ValidationException::class);
    $this->assertDatabaseCount('dataset_imports', 0);
});

it('discovers catalogs under the offstreet prefix and stages them without publishing', function () {
    config(['dataset-deliveries.enabled' => true, 'filesystems.disks.dataset-deliveries.bucket' => 'imports-test']);
    $handler = new MockHandler;
    $client = new S3Client(['version' => 'latest', 'region' => 'auto', 'credentials' => ['key' => 'test', 'secret' => 'test'], 'handler' => $handler, 'retries' => 0]);
    app()->instance(DatasetDeliveryStorage::class, new DatasetDeliveryStorage($client));
    Queue::fake([ProcessDatasetDelivery::class]);
    DatasetSource::factory()->offstreet()->create();
    $json = json_encode(offstreetCatalog(), JSON_THROW_ON_ERROR);
    $key = 'offstreet/nl-amsterdam-garages/'.json_decode($json, true)['delivery_id'].'.json';

    $handler->append(new Result(['IsTruncated' => false]));
    $handler->append(function ($command) {
        expect($command['Prefix'])->toBe('offstreet/')->and($command['Delimiter'])->toBe('/');

        return new Result(['CommonPrefixes' => [['Prefix' => 'offstreet/nl-amsterdam-garages/']], 'IsTruncated' => false]);
    });
    $handler->append(function ($command) use ($key) {
        expect($command['Prefix'])->toBe('offstreet/nl-amsterdam-garages/');

        return new Result(['Contents' => [
            ['Key' => $key, 'ETag' => '"catalog"'],
            ['Key' => 'municipal/nl-amsterdam-garages/'.Str::uuid().'.json', 'ETag' => '"wrong-folder"'],
        ], 'IsTruncated' => false]);
    });
    $this->artisan('nipkaart:discover-deliveries')->assertSuccessful();
    $delivery = DatasetDelivery::sole();
    expect($delivery->object_key)->toBe($key);

    $handler->append(new Result(['Body' => Utils::streamFor($json), 'ContentLength' => strlen($json), 'Metadata' => ['sha256' => hash('sha256', $json)]]));
    (new ProcessDatasetDelivery($delivery->id))->handle(app(DatasetDeliveryService::class));

    expect($delivery->fresh())->state->toBe('validated')->dataset_import_id->toBe(DatasetImport::sole()->id);
    expect(DatasetImport::sole())->state->toBe('pending');
    $this->assertDatabaseCount('parking_offstreet_spaces', 0);
});

it('lists the catalog dataset with its visible facility count', function () {
    DatasetSource::factory()->offstreet()->create();
    $user = offstreetReviewer();
    publishOffstreet(stageOffstreet(offstreetCatalog(), $user), $user);
    ParkingOffstreet::where('name', 'Byzantium')->update(['visibility' => false]);

    $this->actingAs($user)->get(route('app.imports.index'))->assertInertia(fn (Assert $page) => $page
        ->where('datasets.0.target_type', 'offstreet')->where('datasets.0.visible_locations_count', 1));
});
