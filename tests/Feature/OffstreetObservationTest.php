<?php

use App\Enums\ApiState;
use App\Events\DatasetDataChanged;
use App\Events\OffstreetObservationsApplied;
use App\Models\DatasetSource;
use App\Models\ParkingOffstreet;
use App\Services\DatasetDeliveryStorage;
use App\Services\OffstreetObservationService;
use Aws\Command;
use Aws\MockHandler;
use Aws\Result;
use Aws\S3\Exception\S3Exception;
use Aws\S3\S3Client;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->freezeTime();
    config(['dataset-deliveries.enabled' => true, 'filesystems.disks.dataset-deliveries.bucket' => 'observations-test']);
    $this->bucket = new MockHandler;
    $client = new S3Client(['version' => 'latest', 'region' => 'auto', 'credentials' => ['key' => 'test', 'secret' => 'test'], 'handler' => $this->bucket, 'retries' => 0]);
    app()->instance(DatasetDeliveryStorage::class, new DatasetDeliveryStorage($client));
    $this->source = DatasetSource::factory()->offstreet()->create();
    $this->garage = ParkingOffstreet::factory()->create([
        'dataset_source_id' => $this->source->id, 'external_id' => 'G1', 'visibility' => true,
        'api_state' => null, 'occupancy_status' => null, 'capacity' => null, 'free_space' => null,
    ]);
});

/** One observation record in the collector's format; the defaults describe a current, working garage. */
function observation(array $overrides = []): array
{
    return [
        'external_id' => 'G1', 'observed_at' => now()->subMinute()->utc()->format('Y-m-d\TH:i:s\Z'), 'source_state' => 'ok',
        'status' => 'counting', 'capacity' => 400, 'available' => 37, ...$overrides,
    ];
}

function observationDelivery(array $records, array $overrides = []): string
{
    return json_encode([
        'format' => 'nipkaart-offstreet-observations-2', 'dataset' => 'nl-amsterdam-garages', 'selection' => 'car-garages-and-pr',
        'delivery_id' => (string) Str::uuid(), 'fetched_at' => now()->utc()->format('Y-m-d\TH:i:s\Z'),
        'source_count' => count($records), 'records' => $records, ...$overrides,
    ], JSON_THROW_ON_ERROR);
}

function observationKey(string $time): string
{
    return "offstreet-observations/nl-amsterdam-garages/{$time}-".Str::uuid().'.json';
}

/** Lists the given keys and serves `$json` for the newest one, then runs one ingest pass. */
function ingestObservations(MockHandler $bucket, array $keys, ?string $json = null): array
{
    $bucket->append(new Result(['Contents' => array_map(fn (string $key) => ['Key' => $key, 'ETag' => '"etag"'], $keys), 'IsTruncated' => false]));
    if ($json !== null) {
        $bucket->append(new Result(['Body' => Utils::streamFor($json), 'ContentLength' => strlen($json), 'Metadata' => ['sha256' => hash('sha256', $json)]]));
    }

    return app(OffstreetObservationService::class)->ingest();
}

it('applies only the newest delivery with its own capacity and waits for unknown facilities', function () {
    $key = observationKey('20260928T100200Z');
    $json = observationDelivery([observation(['capacity' => 1087, 'available' => 1084]), observation(['external_id' => 'UNKNOWN'])]);

    $result = ingestObservations($this->bucket, [observationKey('20260928T100000Z'), $key], $json);

    expect($result)->toBe(['nl-amsterdam-garages' => ['applied' => 1, 'unknown' => 1]]);
    expect($this->garage->fresh())->api_state->toBe(ApiState::OK)->occupancy_status->toBe('counting')->capacity->toBe(1087)->free_space->toBe(1084)
        ->observed_at->toEqual(now()->subMinute()->startOfSecond());
    expect($this->source->fresh()->last_observation_key)->toBe($key);
    expect(ParkingOffstreet::count())->toBe(1);
});

it('resumes after the last processed key so a delivery is never applied twice', function () {
    $this->source->forceFill(['last_observation_key' => $last = observationKey('20260928T100000Z')])->save();
    $this->bucket->append(function (Command $command) use ($last) {
        expect($command['StartAfter'])->toBe($last);

        return new Result(['Contents' => [], 'IsTruncated' => false]);
    });

    expect(app(OffstreetObservationService::class)->ingest())->toBe(['nl-amsterdam-garages' => null]);
    expect($this->bucket->count())->toBe(0);
});

it('never lets an older, equal or undated measurement replace a newer one', function (array $record, int $expected) {
    $this->garage->forceFill(['api_state' => ApiState::OK, 'free_space' => 50, 'observed_at' => now()->subMinutes(2), 'observation_fetched_at' => now()->subMinutes(2)])->save();

    ingestObservations($this->bucket, [observationKey('20260928T100200Z')], observationDelivery([observation($record)]));

    expect($this->garage->fresh()->free_space)->toBe($expected);
})->with([
    'older' => [['observed_at' => now()->subMinutes(3)->utc()->format('Y-m-d\TH:i:s\Z')], 50],
    'equal time' => [['observed_at' => now()->subMinutes(2)->utc()->format('Y-m-d\TH:i:s\Z')], 50],
    'no source time' => [['observed_at' => null], 50],
    'newer' => [[], 37],
]);

it('keeps unknown distinct from zero and never deletes facilities that are missing from a delivery', function () {
    ParkingOffstreet::factory()->create(['dataset_source_id' => $this->source->id, 'external_id' => 'G2', 'free_space' => 5]);

    ingestObservations($this->bucket, [observationKey('20260928T100200Z')], observationDelivery([observation(['available' => 0, 'capacity' => null])]));

    expect($this->garage->fresh())->free_space->toBe(0)->capacity->toBeNull();
    expect(ParkingOffstreet::where('external_id', 'G2')->sole()->free_space)->toBe(5);
});

it('logs and passes an invalid delivery without changing facilities', function (Closure $change) {
    $records = [observation()];
    $envelope = [];
    $change($records, $envelope);
    $key = observationKey('20260928T100200Z');

    expect(ingestObservations($this->bucket, [$key], observationDelivery($records, $envelope)))->toBe(['nl-amsterdam-garages' => null]);
    expect($this->garage->fresh()->free_space)->toBeNull();
    expect($this->source->fresh()->last_observation_key)->toBe($key);
})->with([
    'other dataset' => [function (&$records, &$envelope) {
        $envelope['dataset'] = 'nl-other';
    }],
    'count mismatch' => [function (&$records, &$envelope) {
        $envelope['source_count'] = 2;
    }],
    'future measurement' => [function (&$records) {
        $records[0]['observed_at'] = now()->addHour()->utc()->format('Y-m-d\TH:i:s\Z');
    }],
    'unknown state' => [function (&$records) {
        $records[0]['source_state'] = 'full';
    }],
    'raw operator status' => [function (&$records) {
        $records[0]['status'] = 'GESLOTEN';
    }],
    'negative count' => [function (&$records) {
        $records[0]['available'] = -1;
    }],
    'missing field' => [function (&$records) {
        unset($records[0]['capacity']);
    }],
    'long-stay field' => [function (&$records) {
        $records[0]['long_available'] = 12;
    }],
    'duplicate id' => [function (&$records, &$envelope) {
        $records[] = observation();
        $envelope['source_count'] = 2;
    }],
]);

it('keeps its position when the bucket cannot be read so the next run retries', function () {
    $this->bucket->append(new S3Exception('unavailable', new Command('ListObjectsV2')));

    expect(app(OffstreetObservationService::class)->ingest())->toBe(['nl-amsterdam-garages' => null]);
    expect($this->source->fresh()->last_observation_key)->toBeNull();
});

it('ignores observations of sources that are not approved', function () {
    $this->source->forceFill(['approval_state' => 'pending'])->save();

    expect(app(OffstreetObservationService::class)->ingest())->toBe([]);
});

it('shows occupancy only for a current measurement and never reads closed as full', function (Closure $state, string $availability, ?int $free, ?string $status) {
    $this->garage->forceFill([
        'api_state' => ApiState::OK, 'occupancy_status' => 'counting', 'capacity' => 400, 'free_space' => 37,
        'observed_at' => now()->subMinute(), 'observation_fetched_at' => now(), ...$state(),
    ])->save();

    $this->getJson(route('map.parking-offstreet.show', $this->garage->id))->assertOk()
        ->assertJsonPath('availability', $availability)->assertJsonPath('free_space', $free)->assertJsonPath('occupancy_status', $status)
        ->assertJsonPath('capacity', 400)->assertJsonMissingPath('free_space_long')->assertJsonMissingPath('accessible_capacity');
})->with([
    'current count' => [fn () => [], 'current', 37, 'counting'],
    'more free than capacity is still shown raw' => [fn () => ['free_space' => 537], 'current', 537, 'counting'],
    'status-only full' => [fn () => ['occupancy_status' => 'full', 'free_space' => null], 'current', null, 'full'],
    'closed with zero free' => [fn () => ['occupancy_status' => 'closed', 'free_space' => 0], 'closed', null, null],
    'malfunction' => [fn () => ['occupancy_status' => 'malfunction'], 'unavailable', null, null],
    'stale after the threshold' => [fn () => ['observed_at' => now()->subMinutes(11)], 'stale', null, null],
    'source error' => [fn () => ['api_state' => ApiState::ERROR], 'unavailable', null, null],
    'no values' => [fn () => ['free_space' => null], 'unavailable', null, null],
    'never measured' => [fn () => ['observed_at' => null, 'api_state' => null], 'unknown', null, null],
]);

it('tells open pages about applied observations, and stays quiet when nothing changed', function () {
    Event::fake([DatasetDataChanged::class, OffstreetObservationsApplied::class]);

    ingestObservations($this->bucket, [observationKey('20260928T100200Z')], observationDelivery([observation(['external_id' => 'UNKNOWN'])]));
    Event::assertNotDispatched(OffstreetObservationsApplied::class);

    ingestObservations($this->bucket, [observationKey('20260928T100400Z')], observationDelivery([observation()]));
    Event::assertDispatched(OffstreetObservationsApplied::class);
    Event::assertDispatched(DatasetDataChanged::class, fn (DatasetDataChanged $event) => $event->broadcastWith() === ['scope' => 'observations', 'target_type' => 'offstreet']
        && $event->broadcastOn()[0]->name === 'private-datasets');
});

it('lists only current and closed garages for the map badges, with the detail rules', function () {
    $current = fn (array $state = []) => ParkingOffstreet::factory()->create([
        'dataset_source_id' => $this->source->id, 'visibility' => true, 'api_state' => ApiState::OK, 'occupancy_status' => 'counting',
        'capacity' => 400, 'free_space' => 37, 'observed_at' => now()->subMinute(), ...$state,
    ]);
    $counting = $current();
    $closed = $current(['occupancy_status' => 'closed', 'free_space' => 0]);
    $current(['observed_at' => now()->subMinutes(11)]);
    $current(['visibility' => false]);
    $current(['api_state' => ApiState::ERROR]);

    $this->getJson(route('map.parking.garage-occupancy'))->assertOk()
        ->assertExactJson(['garages' => [$counting->id => ['counting', 37, 400], $closed->id => ['closed', null, null]]]);
});

it('returns an empty object when no garage has a current measurement', function () {
    $this->getJson(route('map.parking.garage-occupancy'))->assertOk()->assertExactJson(['garages' => []]);
    expect($this->get(route('map.parking.garage-occupancy'))->getContent())->toBe('{"garages":{}}');
});
