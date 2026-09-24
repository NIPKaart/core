<?php

use App\Enums\UserRole;
use App\Jobs\ProcessMunicipalDelivery;
use App\Models\DatasetSource;
use App\Models\MunicipalDelivery;
use App\Models\MunicipalImport;
use App\Models\User;
use App\Notifications\MunicipalImport\ReadyForReview;
use App\Services\MunicipalDeliveryService;
use App\Services\MunicipalDeliveryStorage;
use App\Services\MunicipalImportService;
use Aws\MockHandler;
use Aws\Result;
use Aws\S3\Exception\S3Exception;
use Aws\S3\S3Client;
use GuzzleHttp\Psr7\Response;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

function bucketClient(): array
{
    config(['municipal-deliveries.enabled' => true, 'filesystems.disks.municipal-deliveries.bucket' => 'municipal-test']);
    $handler = new MockHandler;
    $client = new S3Client(['version' => 'latest', 'region' => 'auto', 'credentials' => ['key' => 'test', 'secret' => 'test'], 'handler' => $handler, 'retries' => 0]);
    app()->instance(MunicipalDeliveryStorage::class, new MunicipalDeliveryStorage($client));

    return [$handler, $client];
}

function bucketPayload(array $overrides = []): string
{
    return json_encode(array_replace([
        'format' => 'nipkaart-municipal-pilot-1', 'dataset' => 'nl-amsterdam',
        'delivery_id' => (string) Str::uuid(), 'retrieved_at' => now()->subMinute()->utc()->format('Y-m-d\TH:i:s\Z'),
        'selection' => 'e6a-all', 'complete' => true, 'source_count' => 1,
        'records' => [[
            'external_id' => '000123', 'geometry' => ['type' => 'Polygon', 'coordinates' => [[[4.9, 52.3], [4.91, 52.3], [4.91, 52.31], [4.9, 52.3]]]],
            'number' => null, 'street' => null, 'access_category' => 'general',
            'source_attributes' => ['regimes' => [['eType' => 'E6a', 'eTypeDescription' => 'Gehandicaptenparkeerplaats algemeen']], 'orientation' => null, 'version_date' => null], 'source_updated_at' => null,
        ]],
    ], $overrides), JSON_THROW_ON_ERROR);
}

function bucketObject(string $json, array $overrides = []): Result
{
    return new Result(array_replace(['Body' => Utils::streamFor($json), 'ContentLength' => strlen($json), 'Metadata' => ['sha256' => hash('sha256', $json)]], $overrides));
}

function bucketReceipt(string $json): MunicipalDelivery
{
    $data = json_decode($json, true);

    return MunicipalDelivery::factory()->create(['object_key' => 'municipal/nl-amsterdam/'.$data['delivery_id'].'.json']);
}

it('discovers every listing page and resumes registered but undispatched work', function () {
    [$handler] = bucketClient();
    Queue::fake([ProcessMunicipalDelivery::class]);
    $source = DatasetSource::factory()->create();
    $existing = MunicipalDelivery::factory()->create(['dataset_source_id' => $source->id]);
    $key = 'municipal/'.$source->code.'/'.Str::uuid().'.json';
    $handler->append(new Result(['Contents' => [
        ['Key' => $existing->object_key, 'ETag' => $existing->etag],
        ['Key' => 'municipal/'.$source->code.'/partial.tmp', 'ETag' => 'tmp'],
        ['Key' => 'https://example.test/file.json', 'ETag' => 'url'],
        ['Key' => 'municipal/another/'.Str::uuid().'.json', 'ETag' => 'other'],
    ], 'IsTruncated' => true, 'NextContinuationToken' => 'page-two']));
    $handler->append(function ($command) use ($key) {
        expect($command['ContinuationToken'])->toBe('page-two');

        return new Result(['Contents' => [['Key' => $key, 'ETag' => '"next"']], 'IsTruncated' => false]);
    });
    $this->artisan('nipkaart:discover-municipal-deliveries')->assertSuccessful();
    expect(MunicipalDelivery::count())->toBe(2);
    Queue::assertPushed(ProcessMunicipalDelivery::class, fn ($job) => $job->deliveryId === $existing->id);
    Queue::assertPushed(ProcessMunicipalDelivery::class, 2);
});

it('intakes retained bytes without a user and never publishes automatically', function () {
    [$handler] = bucketClient();
    $json = bucketPayload();
    $delivery = bucketReceipt($json);
    DatasetSource::whereKey($delivery->dataset_source_id)->update(['publication_enabled' => false]);
    $handler->append(bucketObject($json));
    $job = new ProcessMunicipalDelivery($delivery->id);
    $job->handle(app(MunicipalDeliveryService::class));
    $job->handle(app(MunicipalDeliveryService::class));
    $import = MunicipalImport::sole();
    expect($import)->submitted_by->toBeNull()->state->toBe('pending');
    expect($delivery->fresh())->state->toBe('validated')->municipal_import_id->toBe($import->id)->received_at->not->toBeNull()->validated_at->not->toBeNull();
    expect(app(MunicipalImportService::class)->review($import)['blockers'])->toBeEmpty();
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
});

it('retains old deliveries for review and marks their age separately', function () {
    $this->freezeTime();
    [$handler] = bucketClient();
    $json = bucketPayload(['retrieved_at' => now()->subDays(4)->utc()->format('Y-m-d\TH:i:s\Z')]);
    $delivery = bucketReceipt($json);
    $handler->append(bucketObject($json));
    app(MunicipalDeliveryService::class)->process($delivery->id);
    expect($delivery->fresh())->state->toBe('validated')->late_on_receipt->toBeTrue();
    expect(MunicipalImport::sole()->retrieved_at->lessThan($delivery->fresh()->received_at))->toBeTrue();
});

it('rejects incomplete corrupt oversized or mismatched deliveries before staging', function (string $case) {
    [$handler] = bucketClient();
    $json = bucketPayload();
    $delivery = bucketReceipt($json);
    $data = json_decode($json, true);
    $overrides = [];
    match ($case) {
        'checksum' => $overrides = ['Metadata' => ['sha256' => str_repeat('0', 64)]],
        'length' => $overrides = ['ContentLength' => strlen($json) - 1],
        'oversized' => $overrides = ['ContentLength' => 33554433],
        'metadata' => $overrides = ['Metadata' => []],
        'scope' => $data['dataset'] = 'another-source',
        'identity' => $data['delivery_id'] = (string) Str::uuid(),
        'partial' => $data['complete'] = false,
    };
    $handler->append(bucketObject(json_encode($data), $overrides));
    app(MunicipalDeliveryService::class)->process($delivery->id);
    expect($delivery->fresh())->state->toBe('rejected')->error_code->toBe('invalid_delivery');
    $this->assertDatabaseCount('municipal_imports', 0);
})->with(['checksum', 'length', 'oversized', 'metadata', 'scope', 'identity', 'partial']);

it('leaves missing or interrupted objects retryable after a failed attempt', function () {
    [$handler, $client] = bucketClient();
    $json = bucketPayload();
    $delivery = bucketReceipt($json);
    $handler->append(new S3Exception('Missing object', $client->getCommand('GetObject'), ['code' => 'NoSuchKey']));
    expect(fn () => app(MunicipalDeliveryService::class)->process($delivery->id))->toThrow(S3Exception::class);
    expect($delivery->fresh())->state->toBe('pending')->received_at->toBeNull();
    $handler->append(bucketObject($json));
    app(MunicipalDeliveryService::class)->process($delivery->id);
    expect($delivery->fresh())->state->toBe('validated');
});

it('does not fetch when disabled or when a stored object is outside its allowed source', function () {
    bucketClient();
    $delivery = MunicipalDelivery::factory()->create(['object_key' => 'https://example.test/secret']);
    config(['municipal-deliveries.enabled' => false]);
    app(MunicipalDeliveryService::class)->process($delivery->id);
    expect($delivery->fresh())->error_code->toBeNull();
    config(['municipal-deliveries.enabled' => true]);
    app(MunicipalDeliveryService::class)->process($delivery->id);
    expect($delivery->fresh())->error_code->toBe('storage_not_allowed');
    $this->assertDatabaseCount('municipal_imports', 0);
});

it('resumes persisted discovery after a dispatch failure without inserting duplicates', function () {
    [$handler] = bucketClient();
    $source = DatasetSource::factory()->create();
    $key = 'municipal/'.$source->code.'/'.Str::uuid().'.json';
    $page = ['Contents' => [['Key' => $key, 'ETag' => '"etag"']], 'IsTruncated' => false];
    $handler->append(new Result($page));
    Queue::shouldReceive('connection')->andThrow(new RuntimeException('Queue unavailable'));
    expect(fn () => app(MunicipalDeliveryService::class)->discover())->toThrow(RuntimeException::class);
    expect(MunicipalDelivery::sole())->state->toBe('pending');
    $this->travel(6)->minutes();
    Queue::fake([ProcessMunicipalDelivery::class]);
    $handler->append(new Result($page));
    app(MunicipalDeliveryService::class)->discover();
    expect(MunicipalDelivery::count())->toBe(1);
    Queue::assertPushed(ProcessMunicipalDelivery::class, 1);
});

it('rolls back a staged import if processing is interrupted before receipt completion', function () {
    [$handler] = bucketClient();
    $json = bucketPayload();
    $delivery = bucketReceipt($json);
    $handler->append(bucketObject($json));
    MunicipalDelivery::updating(function ($model) {
        if ($model->state === 'validated') {
            throw new RuntimeException('Interrupted after intake');
        }
    });
    try {
        expect(fn () => app(MunicipalDeliveryService::class)->process($delivery->id))->toThrow(RuntimeException::class);
        expect($delivery->fresh())->state->toBe('pending');
        $this->assertDatabaseCount('municipal_imports', 0);
    } finally {
        MunicipalDelivery::flushEventListeners();
    }
    $handler->append(bucketObject($json));
    app(MunicipalDeliveryService::class)->process($delivery->id);
    expect($delivery->fresh())->state->toBe('validated');
    $this->assertDatabaseCount('municipal_imports', 1);
});

it('flags a changed immutable object rather than silently accepting new bytes', function () {
    [$handler] = bucketClient();
    Queue::fake([ProcessMunicipalDelivery::class]);
    $delivery = MunicipalDelivery::factory()->create();
    $handler->append(new Result(['Contents' => [['Key' => $delivery->object_key, 'ETag' => '"changed"']], 'IsTruncated' => false]));
    app(MunicipalDeliveryService::class)->discover();
    expect($delivery->fresh())->state->toBe('rejected')->error_code->toBe('object_changed');
    Queue::assertNothingPushed();
});

it('binds object reads to the discovered etag and rejects a bucket switch', function () {
    [$handler] = bucketClient();
    $json = bucketPayload();
    $delivery = bucketReceipt($json);
    config(['filesystems.disks.municipal-deliveries.bucket' => 'different-bucket']);
    app(MunicipalDeliveryService::class)->process($delivery->id);
    expect($delivery->fresh())->state->toBe('pending')->error_code->toBe('storage_not_allowed');
    config(['filesystems.disks.municipal-deliveries.bucket' => 'municipal-test']);
    $handler->append(function ($command) use ($delivery, $json) {
        expect($command['Bucket'])->toBe('municipal-test');
        expect($command['Key'])->toBe($delivery->object_key);
        expect($command['IfMatch'])->toBe($delivery->etag);

        return bucketObject($json);
    });
    app(MunicipalDeliveryService::class)->process($delivery->id);
    expect($delivery->fresh())->state->toBe('validated')->error_code->toBeNull();
});

it('retries an interrupted stream rather than permanently rejecting the delivery', function () {
    [$handler] = bucketClient();
    $json = bucketPayload();
    $delivery = bucketReceipt($json);
    $handler->append(bucketObject($json, ['Body' => Utils::streamFor(substr($json, 0, 20))]));
    expect(fn () => app(MunicipalDeliveryService::class)->process($delivery->id))->toThrow(RuntimeException::class);
    expect($delivery->fresh())->state->toBe('pending');
    $handler->append(bucketObject($json));
    app(MunicipalDeliveryService::class)->process($delivery->id);
    expect($delivery->fresh())->state->toBe('validated');
});

it('archives a manual upload before opening review and reuses it during automatic intake', function () {
    [$handler] = bucketClient();
    $source = DatasetSource::factory()->create();
    $user = User::factory()->create();
    $user->assignRole(UserRole::ADMIN);
    $json = bucketPayload();
    $data = json_decode($json, true);
    $key = 'municipal/'.$source->code.'/'.$data['delivery_id'].'.json';
    $handler->append(function ($command) use ($json, $key) {
        expect($command->getName())->toBe('PutObject');
        expect($command['Key'])->toBe($key);
        expect((string) $command['Body'])->toBe($json);
        expect($command['IfNoneMatch'])->toBe('*');
        expect($command['ContentMD5'])->toBe(base64_encode(md5($json, true)));
        expect($command['Metadata']['sha256'])->toBe(hash('sha256', $json));

        return new Result(['ETag' => '"uploaded"']);
    });

    $response = $this->actingAs($user)->post(route('app.municipal-imports.store'), [
        'file' => UploadedFile::fake()->createWithContent('downloaded-file.json', $json),
    ]);

    $import = MunicipalImport::firstOrFail();
    $response->assertSessionHasNoErrors()->assertRedirect(route('app.municipal-imports.show', $import));
    expect($import)->state->toBe('pending')->submitted_by->toBe($user->id);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
    $receipt = MunicipalDelivery::factory()->create(['dataset_source_id' => $source->id, 'object_key' => $key, 'etag' => '"uploaded"']);
    $handler->append(bucketObject($json));
    app(MunicipalDeliveryService::class)->process($receipt->id);
    expect($receipt->fresh())->state->toBe('validated')->municipal_import_id->toBe($import->id);
    $this->assertDatabaseCount('municipal_imports', 1);
});

it('rolls back a manual upload when its archive cannot be stored', function (int $status) {
    [$handler, $client] = bucketClient();
    DatasetSource::factory()->create();
    $user = User::factory()->create();
    $user->assignRole(UserRole::ADMIN);
    $handler->append(new S3Exception('Storage unavailable', $client->getCommand('PutObject'), ['response' => new Response($status)]));

    $this->actingAs($user)->post(route('app.municipal-imports.store'), [
        'file' => UploadedFile::fake()->createWithContent('delivery.json', bucketPayload()),
    ])->assertSessionHasErrors(['file' => 'Het bestand kon niet in de bucket worden opgeslagen. Controleer de verbinding en schrijfrechten en probeer opnieuw.']);

    $this->assertDatabaseCount('municipal_imports', 0);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
})->with([403, 503]);

it('accepts an identical archived upload without overwriting the object', function () {
    [$handler, $client] = bucketClient();
    DatasetSource::factory()->create();
    $user = User::factory()->create();
    $user->assignRole(UserRole::ADMIN);
    $json = bucketPayload();
    $existing = app(MunicipalImportService::class)->intake($json, $user);
    $handler->append(new S3Exception('Already exists', $client->getCommand('PutObject'), ['response' => new Response(412)]));
    $handler->append(new Result(['ETag' => '"existing"']));
    $handler->append(bucketObject($json));

    $this->actingAs($user)->post(route('app.municipal-imports.store'), [
        'file' => UploadedFile::fake()->createWithContent('delivery.json', $json),
    ])->assertSessionHasNoErrors()->assertRedirect(route('app.municipal-imports.show', $existing));

    $this->assertDatabaseCount('municipal_imports', 1);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
});

it('rejects an upload when its archived identity contains different bytes', function () {
    [$handler, $client] = bucketClient();
    DatasetSource::factory()->create();
    $user = User::factory()->create();
    $user->assignRole(UserRole::ADMIN);
    $json = bucketPayload();
    $handler->append(new S3Exception('Already exists', $client->getCommand('PutObject'), ['response' => new Response(412)]));
    $handler->append(new Result(['ETag' => '"existing"']));
    $handler->append(bucketObject($json.' '));

    $this->actingAs($user)->post(route('app.municipal-imports.store'), [
        'file' => UploadedFile::fake()->createWithContent('delivery.json', $json),
    ])->assertSessionHasErrors(['file' => 'Deze levering bestaat al in de bucket met andere inhoud. Het bestand is niet overschreven.']);

    $this->assertDatabaseCount('municipal_imports', 0);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
});

it('notifies only import reviewers once when a delivery is ready for review', function () {
    Notification::fake();
    [$handler] = bucketClient();
    $admin = User::factory()->create();
    $admin->assignRole(UserRole::ADMIN);
    $moderator = User::factory()->create();
    $moderator->assignRole(UserRole::MODERATOR);
    $user = User::factory()->create();
    $json = bucketPayload();
    $delivery = bucketReceipt($json);
    $handler->append(bucketObject($json));

    $service = app(MunicipalDeliveryService::class);
    $service->process($delivery->id);
    $service->process($delivery->id);
    app(MunicipalImportService::class)->intake($json, $admin);

    Notification::assertSentToTimes($admin, ReadyForReview::class, 1);
    Notification::assertNotSentTo([$moderator, $user], ReadyForReview::class);
    Notification::assertSentTo($admin, ReadyForReview::class, function ($notification, $channels) use ($admin) {
        expect($channels)->toBe(['database', 'broadcast']);
        expect($notification->afterCommit)->toBeTrue();
        expect($notification->toDatabase($admin)->data)->toBe([
            'type' => 'municipal.import_ready_for_review',
            'params' => ['source_name' => DatasetSource::sole()->name],
            'url' => route('app.municipal-imports.show', MunicipalImport::sole()),
            'meta' => ['import_id' => MunicipalImport::sole()->id],
        ]);
        expect($notification->toBroadcast($admin)->data)->toBe($notification->toDatabase($admin)->data);
        $admin->removeRole(UserRole::ADMIN);
        expect($notification->shouldSend($admin, 'database'))->toBeFalse();

        return true;
    });
});

it('does not notify reviewers when delivery validation fails', function () {
    Notification::fake();
    [$handler] = bucketClient();
    $admin = User::factory()->create();
    $admin->assignRole(UserRole::ADMIN);
    $json = bucketPayload();
    $delivery = bucketReceipt($json);
    $handler->append(bucketObject($json, ['Metadata' => []]));

    app(MunicipalDeliveryService::class)->process($delivery->id);

    expect($delivery->fresh()->state)->toBe('rejected');
    Notification::assertNothingSent();
});
