<?php

use App\Enums\UserRole;
use App\Events\DatasetDataChanged;
use App\Jobs\ProcessDatasetDelivery;
use App\Models\Country;
use App\Models\DatasetDelivery;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\Province;
use App\Models\User;
use App\Notifications\DatasetImport\SourceAwaitingApproval;
use App\Services\DatasetDeliveryService;
use App\Services\DatasetDeliveryStorage;
use App\Services\MunicipalImportService;
use App\Services\OffstreetImportService;
use Aws\MockHandler;
use Aws\Result;
use Aws\S3\S3Client;
use Database\Factories\DatasetSourceFactory;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

function discoveryBucket(): MockHandler
{
    // Same bucket name as the delivery factory, so receipts created by the factory belong to this bucket.
    config(['dataset-deliveries.enabled' => true, 'filesystems.disks.dataset-deliveries.bucket' => 'municipal-test']);
    $handler = new MockHandler;
    $client = new S3Client(['version' => 'latest', 'region' => 'auto', 'credentials' => ['key' => 'test', 'secret' => 'test'], 'handler' => $handler, 'retries' => 0]);
    app()->instance(DatasetDeliveryStorage::class, new DatasetDeliveryStorage($client));

    return $handler;
}

function discoveryAdmin(): User
{
    $user = User::factory()->create();
    $user->assignRole(UserRole::ADMIN);

    return $user;
}

/** Amsterdam reference data as seeded, without an official municipality code yet. */
function amsterdamReference(bool $withMunicipality = true): ?Municipality
{
    $province = Province::factory()->state(['geocode' => 'NL-NH'])->for(Country::factory()->state(['code' => 'NL']))->create();

    return $withMunicipality ? Municipality::factory()->create(['name' => 'Amsterdam', 'country_id' => $province->country_id, 'province_id' => $province->id]) : null;
}

function discoveryDelivery(array $source = []): string
{
    return json_encode([
        'format' => 'nipkaart-municipal-2', 'dataset' => 'nl-amsterdam', 'source' => DatasetSourceFactory::municipalDescription($source),
        'delivery_id' => (string) Str::uuid(), 'retrieved_at' => now()->subMinute()->utc()->format('Y-m-d\TH:i:s\Z'),
        'selection' => 'e6a-all', 'complete' => true, 'source_count' => 1,
        'records' => [[
            'external_id' => '000123', 'geometry' => ['type' => 'Polygon', 'coordinates' => [[[4.9, 52.3], [4.91, 52.3], [4.91, 52.31], [4.9, 52.3]]]],
            'number' => null, 'street' => 'Teststraat', 'access_category' => 'general', 'orientation' => 'parallel',
            'source_attributes' => ['orientation' => 'Langs'], 'source_updated_at' => null,
        ]],
    ], JSON_THROW_ON_ERROR);
}

function objectResult(string $json): Result
{
    return new Result(['Body' => Utils::streamFor($json), 'ContentLength' => strlen($json), 'Metadata' => ['sha256' => hash('sha256', $json)]]);
}

/** One discovery pass over one municipal folder; the newest object is read when the source is unknown. */
function discoverFolder(MockHandler $handler, array $objects, ?string $readJson = null, string $dataset = 'nl-amsterdam', string $type = 'municipal'): void
{
    if ($type === 'offstreet') {
        $handler->append(new Result(['IsTruncated' => false]));
    }
    $handler->append(new Result(['CommonPrefixes' => [['Prefix' => $type.'/'.$dataset.'/']], 'IsTruncated' => false]));
    $handler->append(new Result(['Contents' => $objects, 'IsTruncated' => false]));
    if ($readJson !== null) {
        $handler->append(objectResult($readJson));
    }
    if ($type === 'municipal') {
        $handler->append(new Result(['IsTruncated' => false]));
    }
    app(DatasetDeliveryService::class)->discover();
}

function objectFor(string $json, string $modified, string $type = 'municipal'): array
{
    return ['Key' => $type.'/'.json_decode($json, true)['dataset'].'/'.json_decode($json, true)['delivery_id'].'.json', 'ETag' => '"'.md5($json).'"', 'LastModified' => $modified];
}

it('registers an unknown folder as a source awaiting approval, links the municipality and holds its deliveries', function () {
    Notification::fake();
    Event::fake([DatasetDataChanged::class]);
    Queue::fake([ProcessDatasetDelivery::class]);
    $admin = discoveryAdmin();
    $amsterdam = amsterdamReference();
    $handler = discoveryBucket();
    $older = discoveryDelivery(['name' => 'Older name']);
    $newest = discoveryDelivery();

    discoverFolder($handler, [objectFor($older, '2026-09-27T10:00:00Z'), objectFor($newest, '2026-09-28T10:00:00Z')], $newest);

    $source = DatasetSource::sole();
    expect($source)->code->toBe('nl-amsterdam')->target_type->toBe('municipal')->approval_state->toBe('pending')
        ->name->toBe('Amsterdam algemene gehandicaptenparkeerplaatsen')->licence->toBe('CC0-1.0')
        ->municipality_id->toBe($amsterdam->id)->registration_error->toBeNull();
    expect($amsterdam->fresh())->code_scheme->toBe('nl-cbs')->code->toBe('GM0363');
    expect(DatasetDelivery::where('dataset_source_id', $source->id)->count())->toBe(2);
    Queue::assertNothingPushed();
    Event::assertDispatched(DatasetDataChanged::class, fn (DatasetDataChanged $event) => $event->scope === 'sources');
    Event::assertDispatched(DatasetDataChanged::class, fn (DatasetDataChanged $event) => $event->scope === 'deliveries' && $event->targetType === 'municipal');
    Notification::assertSentTo($admin, SourceAwaitingApproval::class, function (SourceAwaitingApproval $notification) use ($admin, $source) {
        $data = $notification->toDatabase($admin)->data;

        // The link opens this source's detail sheet on the data sources page.
        return $data['type'] === 'dataset.source_awaiting_approval' && $data['params']['source_name'] === $source->name
            && $data['url'] === route('app.imports.index', ['search' => 'nl-amsterdam', 'source' => $source->id]);
    });
});

it('keeps a source with unknown reference data waiting and refuses approval until it exists', function () {
    Queue::fake([ProcessDatasetDelivery::class]);
    $admin = discoveryAdmin();
    $handler = discoveryBucket();
    $json = discoveryDelivery();

    discoverFolder($handler, [objectFor($json, '2026-09-28T10:00:00Z')], $json);

    $source = DatasetSource::sole();
    expect($source)->municipality_id->toBeNull()->registration_error->toContain('NL-NH');
    $this->actingAs($admin)->patch(route('app.imports.sources.update', $source), ['decision' => 'approve'])->assertSessionHasErrors('source');
    expect($source->fresh()->approval_state)->toBe('pending');
    $this->assertDatabaseCount('municipalities', 0);
});

it('creates the municipality on approval and then processes waiting deliveries', function () {
    Queue::fake([ProcessDatasetDelivery::class]);
    $admin = discoveryAdmin();
    amsterdamReference(withMunicipality: false);
    $handler = discoveryBucket();
    $json = discoveryDelivery();
    discoverFolder($handler, [objectFor($json, '2026-09-28T10:00:00Z')], $json);
    $source = DatasetSource::sole();

    $this->actingAs(User::factory()->create())->patch(route('app.imports.sources.update', $source), ['decision' => 'approve'])->assertForbidden();
    $this->actingAs($admin)->patch(route('app.imports.sources.update', $source), ['decision' => 'approve', 'reason' => 'CC0, gebied klopt.'])->assertRedirect();

    $municipality = Municipality::sole();
    expect($municipality)->name->toBe('Amsterdam')->code_scheme->toBe('nl-cbs')->code->toBe('GM0363');
    expect($source->fresh())->approval_state->toBe('approved')->municipality_id->toBe($municipality->id)
        ->reviewed_by->toBe($admin->id)->review_reason->toBe('CC0, gebied klopt.');
    Queue::assertPushed(ProcessDatasetDelivery::class, fn ($job) => $job->deliveryId === DatasetDelivery::sole()->id);
});

it('ignores deliveries of a rejected source until it is approved after all', function () {
    Queue::fake([ProcessDatasetDelivery::class]);
    $admin = discoveryAdmin();
    amsterdamReference();
    $handler = discoveryBucket();
    $json = discoveryDelivery();
    discoverFolder($handler, [objectFor($json, '2026-09-28T10:00:00Z')], $json);
    $source = DatasetSource::sole();

    $this->actingAs($admin)->patch(route('app.imports.sources.update', $source), ['decision' => 'reject', 'reason' => 'Licentie onduidelijk.'])->assertRedirect();
    discoverFolder($handler, [objectFor($json, '2026-09-28T10:00:00Z')]);
    app(DatasetDeliveryService::class)->process(DatasetDelivery::sole()->id);

    expect($source->fresh()->approval_state)->toBe('rejected');
    expect(DatasetDelivery::sole()->state)->toBe('pending');
    Queue::assertNothingPushed();
    $this->assertDatabaseCount('dataset_imports', 0);
});

it('holds a delivery with a changed description for re-approval, but accepts a new interval without it', function () {
    Notification::fake();
    $admin = discoveryAdmin();
    $source = DatasetSource::factory()->create();
    $handler = discoveryBucket();
    $changed = discoveryDelivery(['licence' => 'CC-BY-4.0']);
    $delivery = DatasetDelivery::factory()->create(['dataset_source_id' => $source->id, 'object_key' => objectFor($changed, 'now')['Key'], 'etag' => '"changed"']);
    $handler->append(objectResult($changed));

    app(DatasetDeliveryService::class)->process($delivery->id);

    expect($source->fresh())->approval_state->toBe('pending')->licence->toBe('CC0-1.0')->pending_description->licence->toBe('CC-BY-4.0');
    expect($delivery->fresh()->state)->toBe('pending');
    Notification::assertSentTo($admin, SourceAwaitingApproval::class, fn (SourceAwaitingApproval $notification) => $notification->toDatabase($admin)->data['type'] === 'dataset.source_awaiting_reapproval');
    $this->actingAs($admin)->get(route('app.imports.index', ['source' => $source->id]))->assertInertia(fn (Assert $page) => $page
        ->where('filters.source', $source->id)
        ->where('sources.data.0.approval_state', 'pending')->where('sources.data.0.pending_description.licence', 'CC-BY-4.0'));

    Queue::fake([ProcessDatasetDelivery::class]);
    $this->patch(route('app.imports.sources.update', $source), ['decision' => 'approve'])->assertRedirect();
    expect($source->fresh())->approval_state->toBe('approved')->licence->toBe('CC-BY-4.0')->pending_description->toBeNull();
    Queue::assertPushed(ProcessDatasetDelivery::class, 1);

    $slower = discoveryDelivery(['licence' => 'CC-BY-4.0', 'expected_interval_hours' => 48]);
    $next = DatasetDelivery::factory()->create(['dataset_source_id' => $source->id, 'object_key' => objectFor($slower, 'now')['Key'], 'etag' => '"slower"']);
    $handler->append(objectResult($slower));
    app(DatasetDeliveryService::class)->process($next->id);

    expect($source->fresh())->approval_state->toBe('approved')->expected_interval_hours->toBe(48);
    expect($next->fresh()->state)->toBe('validated');
});

it('registers nothing from an invalid newest delivery and tries again later', function () {
    $handler = discoveryBucket();
    $invalid = discoveryDelivery(['licence' => 'see website']);

    discoverFolder($handler, [objectFor($invalid, '2026-09-28T10:00:00Z')], $invalid);

    $this->assertDatabaseCount('dataset_sources', 0);
    $this->assertDatabaseCount('dataset_deliveries', 0);
});

it('refuses a manual upload for a source that is not approved', function () {
    DatasetSource::factory()->pending()->create();

    $this->mock(DatasetDeliveryStorage::class)->shouldReceive('archive')->never();
    $this->actingAs(discoveryAdmin())->post(route('app.imports.store'), [
        'file' => UploadedFile::fake()->createWithContent('delivery.json', discoveryDelivery()),
    ])->assertSessionHasErrors('dataset');
    expect(DatasetImport::count())->toBe(0);
});

function namurDiscoveryDelivery(): string
{
    $data = json_decode(discoveryDelivery([
        'name' => 'Namur parkeerplaatsen voor personen met beperkte mobiliteit', 'publisher' => 'Ville de Namur',
        'source_url' => 'https://data.namur.be/explore/dataset/namur-parking-emplacements/', 'licence' => 'CC-BY-4.0',
        'terms_url' => 'https://creativecommons.org/licenses/by/4.0/', 'attribution' => 'Ville de Namur; CC-BY-4.0.',
        'area' => ['country' => 'BE', 'subdivision' => 'BE-WNA', 'municipality' => ['scheme' => 'be-ins', 'code' => '92094', 'name' => 'Namur']],
        'bounds' => [4.70, 50.35, 5.05, 50.60],
    ]), true);
    $data['dataset'] = 'be-namur';
    $data['selection'] = 'pmr-all';
    $data['records'] = [[
        'external_id' => '000123', 'geometry' => ['type' => 'Point', 'coordinates' => [4.86, 50.46]],
        'number' => null, 'street' => 'Rue de Bruxelles', 'access_category' => 'general', 'orientation' => null,
        'source_attributes' => ['type' => 'PMR', 'horaire' => '24h/24'], 'source_updated_at' => '2026-09-01',
    ]];

    return json_encode($data, JSON_THROW_ON_ERROR);
}

it('discovers approves publishes and repeats a Belgian source without inventing unknown values', function () {
    $this->freezeTime();
    Queue::fake([ProcessDatasetDelivery::class]);
    $admin = discoveryAdmin();
    $province = Province::factory()->state(['geocode' => 'BE-WNA'])->for(Country::factory()->state(['code' => 'BE']))->create();
    $handler = discoveryBucket();
    $json = namurDiscoveryDelivery();

    discoverFolder($handler, [objectFor($json, '2026-09-28T10:00:00Z')], $json, 'be-namur');

    $source = DatasetSource::sole();
    expect($source)->code->toBe('be-namur')->approval_state->toBe('pending')->municipality_id->toBeNull()->registration_error->toBeNull();
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
    app(DatasetDeliveryService::class)->process(DatasetDelivery::sole()->id);
    $this->assertDatabaseCount('dataset_imports', 0);
    $this->actingAs($admin)->patch(route('app.imports.sources.update', $source), ['decision' => 'approve'])->assertSessionHasNoErrors()->assertRedirect();

    $municipality = Municipality::sole();
    expect($municipality)->code_scheme->toBe('be-ins')->code->toBe('92094')->country_id->toBe($province->country_id)->province_id->toBe($province->id);
    expect($source->fresh())->approval_state->toBe('approved')->municipality_id->toBe($municipality->id)->licence->toBe('CC-BY-4.0');
    Queue::assertPushed(ProcessDatasetDelivery::class, fn ($job) => $job->deliveryId === DatasetDelivery::sole()->id);
    $handler->append(objectResult($json));
    app(DatasetDeliveryService::class)->process(DatasetDelivery::sole()->id);
    $import = DatasetImport::sole();
    expect($import->state)->toBe('pending');
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
    $service = app(MunicipalImportService::class);
    $service->decide($import, $admin, 'publish', null, $service->review($import)['token']);

    $space = ParkingMunicipal::sole();
    expect($space)->municipality_id->toBe($municipality->id)->external_id->toBe('000123')->number->toBeNull()->orientation->toBeNull();
    expect($space->source_record)->toEqual(json_decode($json, true)['records'][0]);
    $this->getJson(route('map.parking.viewport', ['west' => 4.8, 'south' => 50.4, 'east' => 4.9, 'north' => 50.5]))
        ->assertOk()->assertJsonCount(1, 'results')->assertJsonPath('results.0.key', 'municipal:'.$space->id);

    $this->travel(2)->minutes();
    $repeat = json_decode($json, true);
    $repeat['delivery_id'] = (string) Str::uuid();
    $repeat['retrieved_at'] = now()->subMinute()->utc()->format('Y-m-d\TH:i:s\Z');
    $json = json_encode($repeat, JSON_THROW_ON_ERROR);
    discoverFolder($handler, [objectFor($json, '2026-09-28T10:02:00Z')], null, 'be-namur');
    $delivery = DatasetDelivery::latest('id')->firstOrFail();
    $handler->append(objectResult($json));
    app(DatasetDeliveryService::class)->process($delivery->id);
    $import = DatasetImport::latest('id')->firstOrFail();
    expect($service->review($import)['counts']['unchanged'])->toBe(1);
    expect($import)->state->toBe('published')->publication_method->toBe('automatic');

    $this->assertDatabaseCount('parking_municipal_spaces', 1);
    expect($space->fresh())->id->toBe($space->id)->source_record->toEqual($repeat['records'][0])->published_import_id->toBe($import->id);
});

it('holds a Belgian source with an unknown subdivision until reference data is available', function () {
    Queue::fake([ProcessDatasetDelivery::class]);
    $admin = discoveryAdmin();
    Country::factory()->create(['code' => 'BE']);
    $handler = discoveryBucket();
    $json = namurDiscoveryDelivery();

    discoverFolder($handler, [objectFor($json, '2026-09-28T10:00:00Z')], $json, 'be-namur');
    $source = DatasetSource::sole();
    expect($source)->municipality_id->toBeNull()->registration_error->toContain('BE-WNA');
    $this->actingAs($admin)->patch(route('app.imports.sources.update', $source), ['decision' => 'approve'])->assertSessionHasErrors('source');

    expect($source->fresh()->approval_state)->toBe('pending');
    Queue::assertNothingPushed();
    $this->assertDatabaseCount('municipalities', 0);
    $this->assertDatabaseCount('dataset_imports', 0);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
});

it('discovers approves publishes and repeats the Hamburg P+R catalog with German identity', function () {
    $this->freezeTime();
    Notification::fake();
    Queue::fake([ProcessDatasetDelivery::class]);
    $province = Province::factory()->state(['geocode' => 'DE-HH'])->for(Country::factory()->state(['code' => 'DE']))->create();
    $admin = discoveryAdmin();
    $handler = discoveryBucket();
    $data = json_decode(discoveryDelivery(), true);
    $data = array_replace($data, [
        'format' => 'nipkaart-offstreet-catalog-3', 'dataset' => 'de-hamburg-pr', 'selection' => 'pr-all',
        'source' => DatasetSourceFactory::offstreetDescription([
            'name' => 'Hamburg Park + Ride Anlagen', 'publisher' => 'Freie und Hansestadt Hamburg',
            'source_url' => 'https://api.hamburg.de/datasets/v1/p_und_r/collections/p_und_r/items',
            'licence' => 'DL-DE-BY-2.0', 'terms_url' => 'https://suche.transparenz.hamburg.de/dataset/park-ride-anlagen-hamburg32',
            'attribution' => 'Freie und Hansestadt Hamburg, BVM; Datenlizenz Deutschland – Namensnennung – Version 2.0',
            'area' => ['country' => 'DE', 'subdivision' => 'DE-HH', 'municipality' => ['scheme' => 'de-ags', 'code' => '02000000', 'name' => 'Hamburg']],
            'bounds' => [9.7, 53.35, 10.35, 53.8],
        ]),
        'records' => [['external_id' => '12675697', 'name' => 'Volksdorf', 'source_name' => 'Volksdorf',
            'facility_type' => 'park_and_ride', 'geometry' => ['type' => 'Point', 'coordinates' => [10.16169, 53.64967]]]],
    ]);
    $json = json_encode($data, JSON_THROW_ON_ERROR);

    discoverFolder($handler, [objectFor($json, '2026-10-10T20:00:00Z', 'offstreet')], $json, 'de-hamburg-pr', 'offstreet');

    $source = DatasetSource::sole();
    expect($source)->approval_state->toBe('pending')->municipality_id->toBeNull();
    $this->assertDatabaseCount('parking_offstreet_spaces', 0);
    $this->actingAs($admin)->patch(route('app.imports.sources.update', $source), ['decision' => 'approve'])->assertRedirect();
    $municipality = $source->fresh()->municipality;
    expect($municipality)->code_scheme->toBe('de-ags')->code->toBe('02000000')->province_id->toBe($province->id);
    $handler->append(objectResult($json));
    app(DatasetDeliveryService::class)->process(DatasetDelivery::sole()->id);
    $service = app(OffstreetImportService::class);
    $import = DatasetImport::sole();
    $service->decide($import, $admin, 'publish', null, $service->review($import)['token']);
    $facility = ParkingOffstreet::sole();
    expect($facility)->external_id->toBe('12675697')->parking_type->toBe('parkandride')->municipality_id->toBe($municipality->id)
        ->capacity->toBeNull()->free_space->toBeNull()->observed_at->toBeNull();

    $this->travel(2)->minutes();
    $data['delivery_id'] = (string) Str::uuid();
    $data['retrieved_at'] = now()->subMinute()->utc()->format('Y-m-d\TH:i:s\Z');
    $json = json_encode($data, JSON_THROW_ON_ERROR);
    discoverFolder($handler, [objectFor($json, '2026-10-10T20:02:00Z', 'offstreet')], null, 'de-hamburg-pr', 'offstreet');
    $handler->append(objectResult($json));
    app(DatasetDeliveryService::class)->process(DatasetDelivery::latest('id')->firstOrFail()->id);
    $repeat = DatasetImport::latest('id')->firstOrFail();
    expect($service->review($repeat)['counts']['unchanged'])->toBe(1);
    expect($repeat)->state->toBe('published')->publication_method->toBe('automatic');
    $this->assertDatabaseCount('parking_offstreet_spaces', 1);
    expect($facility->fresh())->id->toBe($facility->id)->published_import_id->toBe($repeat->id);
});

function stockholmDiscoveryDelivery(): string
{
    $data = json_decode(discoveryDelivery(), true);
    $data['dataset'] = 'se-stockholm';
    $data['selection'] = 'prorelsehindrad-all';
    $data['source'] = [
        ...$data['source'], 'name' => 'Stockholm parking regulations', 'publisher' => 'Stockholms stad, Trafikkontoret',
        'source_url' => 'https://openparking.stockholm.se/LTF-Tolken/v1/prorelsehindrad/all',
        'licence' => null, 'terms_url' => 'https://openstreetws.stockholm.se/home/', 'attribution' => 'Stockholms stad, Trafikkontoret',
        'area' => ['country' => 'SE', 'subdivision' => 'SE-AB', 'municipality' => ['scheme' => 'se-scb', 'code' => '0180', 'name' => 'Stockholm']],
        'bounds' => [17.7, 59.2, 18.3, 59.5],
    ];
    $data['records'][0]['geometry'] = ['type' => 'LineString', 'coordinates' => [[18.08, 59.30], [18.09, 59.31]]];
    $data['records'][0]['access_category'] = 'unknown';
    $data['records'][0]['orientation'] = null;

    return json_encode($data, JSON_THROW_ON_ERROR);
}

it('discovers approves publishes and repeats a Swedish source without inventing unknown values', function () {
    $this->freezeTime();
    Queue::fake([ProcessDatasetDelivery::class]);
    $admin = discoveryAdmin();
    $province = Province::factory()->state(['geocode' => 'SE-AB'])->for(Country::factory()->state(['code' => 'SE']))->create();
    $handler = discoveryBucket();
    $json = stockholmDiscoveryDelivery();

    discoverFolder($handler, [objectFor($json, '2026-09-28T10:00:00Z')], $json, 'se-stockholm');

    $source = DatasetSource::sole();
    expect($source)->code->toBe('se-stockholm')->approval_state->toBe('pending')->municipality_id->toBeNull()->registration_error->toBeNull();
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
    app(DatasetDeliveryService::class)->process(DatasetDelivery::sole()->id);
    $this->assertDatabaseCount('dataset_imports', 0);
    $this->actingAs($admin)->patch(route('app.imports.sources.update', $source), ['decision' => 'approve'])->assertSessionHasNoErrors()->assertRedirect();

    $municipality = Municipality::sole();
    expect($municipality)->code_scheme->toBe('se-scb')->code->toBe('0180')->country_id->toBe($province->country_id)->province_id->toBe($province->id);
    expect($source->fresh())->approval_state->toBe('approved')->municipality_id->toBe($municipality->id)->licence->toBeNull();
    Queue::assertPushed(ProcessDatasetDelivery::class, fn ($job) => $job->deliveryId === DatasetDelivery::sole()->id);
    $handler->append(objectResult($json));
    app(DatasetDeliveryService::class)->process(DatasetDelivery::sole()->id);
    $import = DatasetImport::sole();
    expect($import->state)->toBe('pending');
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
    $service = app(MunicipalImportService::class);
    $service->decide($import, $admin, 'publish', null, $service->review($import)['token']);

    $space = ParkingMunicipal::sole();
    expect($space)->municipality_id->toBe($municipality->id)->external_id->toBe('000123')->number->toBeNull()->orientation->toBeNull();
    expect($space->source_record)->toEqual(json_decode($json, true)['records'][0]);
    $this->getJson(route('map.parking.viewport', ['west' => 17.7, 'south' => 59.2, 'east' => 18.2, 'north' => 59.5]))
        ->assertOk()->assertJsonCount(1, 'results')->assertJsonPath('results.0.key', 'municipal:'.$space->id);

    $this->travel(2)->minutes();
    $repeat = json_decode($json, true);
    $repeat['delivery_id'] = (string) Str::uuid();
    $repeat['retrieved_at'] = now()->subMinute()->utc()->format('Y-m-d\TH:i:s\Z');
    $json = json_encode($repeat, JSON_THROW_ON_ERROR);
    discoverFolder($handler, [objectFor($json, '2026-09-28T10:02:00Z')], null, 'se-stockholm');
    $delivery = DatasetDelivery::latest('id')->firstOrFail();
    $handler->append(objectResult($json));
    app(DatasetDeliveryService::class)->process($delivery->id);
    $import = DatasetImport::latest('id')->firstOrFail();
    expect($service->review($import)['counts']['unchanged'])->toBe(1);
    expect($import)->state->toBe('published')->publication_method->toBe('automatic');

    $this->assertDatabaseCount('parking_municipal_spaces', 1);
    expect($space->fresh())->id->toBe($space->id)->source_record->toEqual($repeat['records'][0])->published_import_id->toBe($import->id);
});

it('rejects invalid Swedish identities before registering a source', function (array $municipality, string $country) {
    $handler = discoveryBucket();
    $data = json_decode(stockholmDiscoveryDelivery(), true);
    $data['source']['area']['country'] = $country;
    $data['source']['area']['municipality'] = [...$data['source']['area']['municipality'], ...$municipality];
    $json = json_encode($data, JSON_THROW_ON_ERROR);

    discoverFolder($handler, [objectFor($json, '2026-09-28T10:00:00Z')], $json, 'se-stockholm');

    $this->assertDatabaseCount('dataset_sources', 0);
    $this->assertDatabaseCount('dataset_deliveries', 0);
})->with([
    'missing leading zero' => [['code' => '180'], 'SE'],
    'non numeric code' => [['code' => '01AB'], 'SE'],
    'foreign scheme' => [['scheme' => 'be-ins', 'code' => '92094'], 'SE'],
    'foreign country' => [['scheme' => 'se-scb', 'code' => '0180'], 'NL'],
]);

it('accepts a complete live Stockholm delivery through isolated approval publication and repeat intake', function () {
    Queue::fake([ProcessDatasetDelivery::class]);
    $admin = discoveryAdmin();
    Province::factory()->state(['geocode' => 'SE-AB'])->for(Country::factory()->state(['code' => 'SE']))->create();
    $handler = discoveryBucket();
    $json = file_get_contents(getenv('STOCKHOLM_ACCEPTANCE_FILE'));
    $data = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
    $count = $data['source_count'];
    expect($data['dataset'])->toBe('se-stockholm')->and($count)->toBeGreaterThan(0);

    discoverFolder($handler, [objectFor($json, now()->toIso8601String())], $json, 'se-stockholm');

    $source = DatasetSource::sole();
    expect($source)->approval_state->toBe('pending');
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
    $this->actingAs($admin)->patch(route('app.imports.sources.update', $source), ['decision' => 'approve'])->assertSessionHasNoErrors();
    $handler->append(objectResult($json));
    app(DatasetDeliveryService::class)->process(DatasetDelivery::sole()->id);
    $service = app(MunicipalImportService::class);
    $import = DatasetImport::sole();
    expect($service->review($import)['counts']['new'])->toBe($count);
    $service->decide($import, $admin, 'publish', null, $service->review($import)['token'], true);
    $this->assertDatabaseCount('parking_municipal_spaces', $count);
    $first = ParkingMunicipal::where('external_id', $data['records'][0]['external_id'])->sole();
    expect($first->source_record)->toEqual($data['records'][0]);

    $this->travel(2)->minutes();
    $data['delivery_id'] = (string) Str::uuid();
    $data['retrieved_at'] = now()->subMinute()->utc()->format('Y-m-d\TH:i:s\Z');
    $repeat = json_encode($data, JSON_THROW_ON_ERROR);
    discoverFolder($handler, [objectFor($repeat, now()->toIso8601String())], null, 'se-stockholm');
    $handler->append(objectResult($repeat));
    app(DatasetDeliveryService::class)->process(DatasetDelivery::latest('id')->firstOrFail()->id);
    $import = DatasetImport::latest('id')->firstOrFail();
    expect($service->review($import)['counts']['unchanged'])->toBe($count);
    expect($import)->state->toBe('published')->publication_method->toBe('automatic');

    $this->assertDatabaseCount('parking_municipal_spaces', $count);
    expect($first->fresh())->id->toBe($first->id)->published_import_id->toBe($import->id);
})->skip(fn () => ! getenv('STOCKHOLM_ACCEPTANCE_FILE'), 'Provide a live collector export for isolated acceptance.');

it('accepts Köln through discovery approval publication and repeated intake preserving source claims', function () {
    Queue::fake([ProcessDatasetDelivery::class]);
    $admin = discoveryAdmin();
    Province::factory()->state(['geocode' => 'DE-NW'])->for(Country::factory()->state(['code' => 'DE']))->create();
    $handler = discoveryBucket();
    $file = getenv('KOELN_ACCEPTANCE_FILE');
    if ($file) {
        $json = file_get_contents($file);
    } else {
        $data = json_decode(discoveryDelivery(), true, flags: JSON_THROW_ON_ERROR);
        $data['dataset'] = 'de-koeln';
        $data['selection'] = 'general-disabled-all';
        $data['source'] = [...$data['source'],
            'name' => 'Köln allgemeine Behindertenparkplätze', 'publisher' => 'Stadt Köln, Amt für Verkehrsmanagement',
            'source_url' => 'https://www.offenedaten-koeln.de/api/1/metastore/schemas/dataset/items/b69bcbd9-f6b2-4bc2-a763-118a471f59c9',
            'licence' => 'DL-DE-ZERO-2.0', 'terms_url' => 'https://www.govdata.de/dl-de/zero-2-0', 'attribution' => 'Stadt Köln',
            'area' => ['country' => 'DE', 'subdivision' => 'DE-NW', 'municipality' => ['scheme' => 'de-ags', 'code' => '05315000', 'name' => 'Köln']],
            'bounds' => [6.75, 50.80, 7.20, 51.10],
        ];
        $data['source_count'] = 3;
        $data['records'] = [];
        foreach ([null, 0, 2] as $index => $number) {
            $data['records'][] = [
                'external_id' => (string) ($index + 1), 'geometry' => ['type' => 'Point', 'coordinates' => [6.95 + $index * 0.001, 50.94]],
                'number' => $number, 'street' => null, 'access_category' => 'general', 'orientation' => null,
                'source_attributes' => ['id' => $index + 1, 'anzahl' => $number, 'bezeichnung' => 'Straße 23', 'bemerkung' => 'Mo-Fr 9-17 Uhr, 2 Stunden'],
                'source_updated_at' => null,
            ];
        }
        $json = json_encode($data, JSON_THROW_ON_ERROR);
    }
    $data = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
    $count = $data['source_count'];
    expect($data['dataset'])->toBe('de-koeln');
    expect($count)->toBeGreaterThan(0);

    discoverFolder($handler, [objectFor($json, now()->toIso8601String())], $json, 'de-koeln');

    $source = DatasetSource::sole();
    expect($source)->approval_state->toBe('pending')->registration_error->toBeNull();
    app(DatasetDeliveryService::class)->process(DatasetDelivery::sole()->id);
    $this->assertDatabaseCount('dataset_imports', 0);
    $this->actingAs($admin)->patch(route('app.imports.sources.update', $source), ['decision' => 'approve'])->assertSessionHasNoErrors();
    expect(Municipality::sole())->code_scheme->toBe('de-ags')->code->toBe('05315000');
    Queue::assertPushed(ProcessDatasetDelivery::class, fn ($job) => $job->deliveryId === DatasetDelivery::sole()->id);
    $handler->append(objectResult($json));
    app(DatasetDeliveryService::class)->process(DatasetDelivery::sole()->id);
    $service = app(MunicipalImportService::class);
    $import = DatasetImport::sole();
    expect($service->review($import)['counts']['new'])->toBe($count);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
    $service->decide($import, $admin, 'publish', null, $service->review($import)['token'], true);
    $this->assertDatabaseCount('parking_municipal_spaces', $count);
    $spaces = ParkingMunicipal::all()->keyBy('external_id');
    foreach ($data['records'] as $record) {
        $space = $spaces[$record['external_id']];
        expect($space)->source_record->toEqual($record)->number->toBe($record['number'])->orientation->toBeNull()->street->toBeNull();
    }
    $identities = $spaces->map->id->all();

    $this->travel(2)->minutes();
    $data['delivery_id'] = (string) Str::uuid();
    $data['retrieved_at'] = now()->subMinute()->utc()->format('Y-m-d\TH:i:s\Z');
    $repeat = json_encode($data, JSON_THROW_ON_ERROR);
    discoverFolder($handler, [objectFor($repeat, now()->toIso8601String())], null, 'de-koeln');
    $handler->append(objectResult($repeat));
    app(DatasetDeliveryService::class)->process(DatasetDelivery::latest('id')->firstOrFail()->id);
    $import = DatasetImport::latest('id')->firstOrFail();
    expect($service->review($import)['counts']['unchanged'])->toBe($count);
    expect($import)->state->toBe('published')->publication_method->toBe('automatic');

    $this->assertDatabaseCount('parking_municipal_spaces', $count);
    expect(ParkingMunicipal::all()->keyBy('external_id')->map->id->all())->toEqual($identities);
});
