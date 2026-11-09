<?php

use App\Enums\UserRole;
use App\Jobs\ProcessDatasetDelivery;
use App\Models\Country;
use App\Models\DatasetDelivery;
use App\Models\DatasetSource;
use App\Models\Municipality;
use App\Models\Province;
use App\Models\User;
use App\Services\DatasetDeliveryService;
use App\Services\DatasetDeliveryStorage;
use App\Services\SourceRegistrar;
use App\Support\LocationProposalSnapshot;
use Aws\MockHandler;
use Aws\Result;
use Aws\S3\S3Client;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['dataset-deliveries.enabled' => true, 'filesystems.disks.dataset-deliveries.bucket' => 'proposals-test']);
    Notification::fake();
    Queue::fake([ProcessDatasetDelivery::class]);
    $this->handler = new MockHandler;
    $client = new S3Client(['version' => 'latest', 'region' => 'auto', 'credentials' => ['key' => 'test', 'secret' => 'test'], 'handler' => $this->handler, 'retries' => 0]);
    app()->instance(DatasetDeliveryStorage::class, new DatasetDeliveryStorage($client));
    $country = Country::factory()->create(['code' => 'NL']);
    Province::factory()->for($country)->create(['geocode' => 'NL-ZH']);
    Province::factory()->for($country)->create(['geocode' => 'NL-NH']);
});

function proposalPoint(?string $code = 'GM0503', bool $personal = false, float $longitude = 4.36): array
{
    return [
        'external_id' => (string) Str::uuid(),
        'geometry' => ['type' => 'Point', 'coordinates' => [$longitude, 52.01]],
        'municipality_code' => $code, 'source_last_seen_on' => '2026-11-01',
        'under_sign_types' => $personal ? ['KEN'] : ['TIJD'], 'personal' => $personal,
    ];
}

function proposalEnvelope(array $points, int $hours = 1, array $overrides = []): array
{
    return array_replace([
        // The real collector writes records before the metadata.
        'records' => $points, 'format' => LocationProposalSnapshot::FORMAT, 'dataset' => 'nl-ndw-e6',
        'delivery_id' => (string) Str::uuid(), 'selection' => 'placed-e6-all', 'complete' => true,
        'source_count' => count($points), 'pages_fetched' => 1, 'upstream_total' => null,
        'retrieved_at' => now()->subHours($hours)->utc()->format('Y-m-d\TH:i:s.u\Z'),
        'source' => [
            'name' => 'NDW verkeersborden E6', 'publisher' => 'NDW', 'source_url' => 'https://example.test/data',
            'licence' => null, 'terms_url' => 'https://example.test/terms', 'attribution' => 'NDW',
            'area' => ['country' => 'NL'], 'bounds' => [3, 50.5, 7.5, 54], 'expected_interval_hours' => 24,
        ],
    ], $overrides);
}

function proposalObject(array $data): Result
{
    $json = json_encode($data, JSON_THROW_ON_ERROR);

    return new Result(['Body' => Utils::streamFor($json), 'ContentLength' => strlen($json), 'Metadata' => ['sha256' => hash('sha256', $json)]]);
}

function processProposalObject(MockHandler $handler, DatasetSource $source, array $data): DatasetDelivery
{
    $receipt = DatasetDelivery::create([
        'dataset_source_id' => $source->id, 'bucket' => 'proposals-test',
        'object_key' => 'proposals/'.$source->code.'/'.$data['delivery_id'].'.json', 'etag' => '"snapshot"',
    ]);
    $handler->append(proposalObject($data));
    app(DatasetDeliveryService::class)->process($receipt->id);

    return $receipt->refresh();
}

it('discovers and approves a national source, then reconciles evidence without publication', function () {
    $delft = proposalPoint();
    $amsterdam = proposalPoint('GM0363');
    $personal = proposalPoint(personal: true);
    $unknown = proposalPoint('GM0000');
    $unresolved = proposalPoint(null);
    $data = proposalEnvelope([$delft, $amsterdam, $personal, $unknown, $unresolved], 3);
    $key = 'proposals/nl-ndw-e6/'.$data['delivery_id'].'.json';

    $this->handler->append(new Result(['IsTruncated' => false]));
    $this->handler->append(new Result(['IsTruncated' => false]));
    $this->handler->append(function ($command) {
        expect($command['Prefix'])->toBe('proposals/');

        return new Result(['CommonPrefixes' => [['Prefix' => 'proposals/nl-ndw-e6/']], 'IsTruncated' => false]);
    });
    $this->handler->append(new Result(['Contents' => [['Key' => $key, 'ETag' => '"snapshot"']], 'IsTruncated' => false]));
    $this->handler->append(proposalObject($data));
    $service = app(DatasetDeliveryService::class);
    $service->discover();
    $source = DatasetSource::sole();
    $receipt = DatasetDelivery::sole();
    expect($source)->approval_state->toBe('pending')->municipality_id->toBeNull();
    $service->process($receipt->id);
    $this->assertDatabaseCount('location_proposal_points', 0);
    Queue::assertNothingPushed();

    $admin = User::factory()->create()->assignRole(UserRole::ADMIN);
    app(SourceRegistrar::class)->approve($source, $admin, null);
    Queue::assertPushed(ProcessDatasetDelivery::class);
    $this->handler->append(proposalObject($data));
    $service->process($receipt->id);
    $service->process($receipt->id);
    expect($receipt->refresh())->state->toBe('validated')->dataset_import_id->toBeNull();
    $this->assertDatabaseCount('dataset_imports', 0);
    $this->assertDatabaseCount('parking_spaces', 0);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
    $this->assertDatabaseCount('location_proposal_points', 5);
    $this->assertDatabaseCount('location_proposals', 2);
    $id = DB::table('location_proposal_points')->where('external_id', $delft['external_id'])->value('id');
    $delftId = Municipality::where('code', 'GM0503')->value('id');
    expect($delftId)->not->toBeNull();
    $this->assertDatabaseHas('location_proposal_points', ['external_id' => $personal['external_id'], 'personal' => true, 'location_proposal_id' => null]);
    $this->assertDatabaseHas('location_proposal_points', ['external_id' => $unknown['external_id'], 'municipality_id' => null]);

    $moderator = User::factory()->create()->assignRole(UserRole::MODERATOR);
    $this->actingAs($moderator)->get(route('app.moderation.proposals.index', ['municipality' => $delftId, 'proposal' => $id]))
        ->assertInertia(fn (Assert $page) => $page->component('backend/moderation/proposals')
            ->where('proposals.total', 1)->where('proposals.data.0.points.0.external_id', $delft['external_id'])
            ->where('selected.id', $id));
    $this->actingAs(User::factory()->create())->get(route('app.moderation.proposals.index'))->assertForbidden();

    $missing = proposalEnvelope([$amsterdam, $personal, $unknown, $unresolved], 2);
    expect(processProposalObject($this->handler, $source, $missing)->state)->toBe('validated');
    $point = DB::table('location_proposal_points')->where('id', $id);
    expect($point->value('missing_since'))->not->toBeNull();
    expect(processProposalObject($this->handler, $source, proposalEnvelope($data['records'], 4))->state)->toBe('validated');
    expect($point->value('missing_since'))->not->toBeNull();

    expect(processProposalObject($this->handler, $source, proposalEnvelope($data['records']))->state)->toBe('validated');
    expect($point->value('missing_since'))->toBeNull();
    $this->assertDatabaseCount('location_proposal_points', 5);
    $this->assertDatabaseCount('location_proposals', 2);
});

it('rolls back already written chunks when late evidence is invalid', function () {
    $points = array_map(fn () => proposalPoint(), range(1, 500));
    $points[] = $points[0];
    $data = proposalEnvelope($points);
    $source = app(SourceRegistrar::class)->register('proposals', $data);
    app(SourceRegistrar::class)->approve($source, User::factory()->create()->assignRole(UserRole::ADMIN), null);

    expect(processProposalObject($this->handler, $source, $data)->state)->toBe('rejected');
    $this->assertDatabaseCount('location_proposal_points', 0);
    $this->assertDatabaseCount('location_proposals', 0);
    expect($source->fresh()->last_proposal_retrieved_at)->toBeNull();
});

it('groups nearby points explicitly and preserves the group on later deliveries', function () {
    $data = proposalEnvelope([proposalPoint(), proposalPoint(longitude: 4.3601)], 2);
    $source = app(SourceRegistrar::class)->register('proposals', $data);
    app(SourceRegistrar::class)->approve($source, User::factory()->create()->assignRole(UserRole::ADMIN), null);
    expect(processProposalObject($this->handler, $source, $data)->state)->toBe('validated');
    [$first, $second] = DB::table('location_proposals')->orderBy('id')->pluck('id')->all();

    $moderator = User::factory()->create()->assignRole(UserRole::MODERATOR);
    $this->actingAs($moderator)->post(route('app.moderation.proposals.group', $first), ['with' => $second])->assertRedirect();
    expect(processProposalObject($this->handler, $source, proposalEnvelope($data['records']))->state)->toBe('validated');
    $this->get(route('app.moderation.proposals.index', ['proposal' => $first]))
        ->assertInertia(fn (Assert $page) => $page->where('proposals.total', 1)->has('selected.points', 2));
});

it('requires reapproval for changed terms without letting malformed points stop an approved source', function () {
    $point = proposalPoint();
    $data = proposalEnvelope([$point], 3);
    $source = app(SourceRegistrar::class)->register('proposals', $data);
    $admin = User::factory()->create()->assignRole(UserRole::ADMIN);
    app(SourceRegistrar::class)->approve($source, $admin, null);
    expect(processProposalObject($this->handler, $source, $data)->state)->toBe('validated');

    $changed = [...$data['source'], 'terms_url' => 'https://example.test/updated'];
    $malformed = proposalEnvelope([array_replace($point, ['under_sign_types' => ['plate-text']])], 2, ['source' => $changed]);
    expect(processProposalObject($this->handler, $source, $malformed)->state)->toBe('rejected');
    expect($source->fresh()->approval_state)->toBe('approved');

    $receipt = processProposalObject($this->handler, $source, proposalEnvelope([$point], 1, ['source' => $changed]));
    expect($receipt->state)->toBe('pending');
    expect($source->fresh()->approval_state)->toBe('pending');
    $this->assertDatabaseCount('location_proposals', 1);
    app(SourceRegistrar::class)->approve($source, $admin, null);
    expect($source->fresh()->description['terms_url'])->toBe($changed['terms_url']);
});

it('counts open proposals once per municipality and continues within the chosen municipality', function () {
    $data = proposalEnvelope([
        proposalPoint(),
        proposalPoint('GM0363', longitude: 4.9),
        proposalPoint(longitude: 4.3601),
        proposalPoint(longitude: 4.361),
        proposalPoint(longitude: 4.362),
        proposalPoint(longitude: 4.363),
    ]);
    $source = app(SourceRegistrar::class)->register('proposals', $data);
    app(SourceRegistrar::class)->approve($source, User::factory()->create()->assignRole(UserRole::ADMIN), null);
    expect(processProposalObject($this->handler, $source, $data)->state)->toBe('validated');
    [$first, $amsterdam, $grouped, $closed, $missing, $last] = collect($data['records'])->map(fn (array $point) => DB::table('location_proposal_points')
        ->where('external_id', $point['external_id'])->value('location_proposal_id'))->all();
    $delftId = Municipality::where('code', 'GM0503')->value('id');
    $amsterdamId = Municipality::where('code', 'GM0363')->value('id');
    DB::table('location_proposal_points')->where('location_proposal_id', $missing)->update(['missing_since' => now()]);
    DB::table('location_proposals')->where('id', $closed)->update(['closed_at' => now()]);

    $moderator = User::factory()->create()->assignRole(UserRole::MODERATOR);
    $route = fn (array $query = []) => route('app.moderation.proposals.index', $query);
    $this->actingAs($moderator)->post(route('app.moderation.proposals.group', $first), ['with' => $grouped])->assertRedirect();
    $this->get($route())->assertInertia(fn (Assert $page) => $page
        ->where('proposals', null)->where('municipality', null)
        ->where('municipalities', [
            ['id' => $amsterdamId, 'name' => 'Amsterdam', 'open_count' => 1, 'point' => ['latitude' => 52.01, 'longitude' => 4.9]],
            ['id' => $delftId, 'name' => 'Delft', 'open_count' => 2, 'point' => ['latitude' => 52.01, 'longitude' => 4.36]],
        ]));
    $this->get($route(['municipality' => $delftId]))
        ->assertCookie('proposal_municipality_'.$moderator->id, (string) $delftId)
        ->assertInertia(fn (Assert $page) => $page->where('proposals.total', 2)->where('municipalityName', 'Delft')->where('hasNext', true));
    $this->withCookie('proposal_municipality_'.$moderator->id, (string) $delftId)
        ->get($route())->assertRedirect($route(['municipality' => $delftId]));
    $this->get($route(['overview' => 1]))->assertInertia(fn (Assert $page) => $page->where('municipality', null));

    $this->get($route(['municipality' => $delftId, 'after' => 0]))
        ->assertRedirect($route(['municipality' => $delftId, 'proposal' => $first]));
    $this->get($route(['municipality' => $delftId, 'after' => $first]))
        ->assertRedirect($route(['municipality' => $delftId, 'proposal' => $last]));
    $this->get($route(['municipality' => $delftId, 'after' => $last]))
        ->assertRedirect($route(['municipality' => $delftId, 'proposal' => $first]));
    $this->get($route(['municipality' => $amsterdamId, 'after' => $amsterdam]))
        ->assertRedirect($route(['municipality' => $amsterdamId]));
    $this->get($route(['proposal' => $amsterdam]))->assertInertia(fn (Assert $page) => $page
        ->where('municipality', $amsterdamId)->where('hasNext', false));
});
