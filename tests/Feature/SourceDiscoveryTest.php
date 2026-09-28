<?php

use App\Enums\UserRole;
use App\Events\DatasetDataChanged;
use App\Jobs\ProcessDatasetDelivery;
use App\Models\Country;
use App\Models\DatasetDelivery;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\Municipality;
use App\Models\Province;
use App\Models\User;
use App\Notifications\DatasetImport\SourceAwaitingApproval;
use App\Services\DatasetDeliveryService;
use App\Services\DatasetDeliveryStorage;
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
function discoverFolder(MockHandler $handler, array $objects, ?string $readJson = null): void
{
    $handler->append(new Result(['CommonPrefixes' => [['Prefix' => 'municipal/nl-amsterdam/']], 'IsTruncated' => false]));
    $handler->append(new Result(['Contents' => $objects, 'IsTruncated' => false]));
    if ($readJson !== null) {
        $handler->append(objectResult($readJson));
    }
    $handler->append(new Result(['IsTruncated' => false]));
    app(DatasetDeliveryService::class)->discover();
}

function objectFor(string $json, string $modified): array
{
    return ['Key' => 'municipal/nl-amsterdam/'.json_decode($json, true)['delivery_id'].'.json', 'ETag' => '"'.md5($json).'"', 'LastModified' => $modified];
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
