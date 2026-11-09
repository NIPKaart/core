<?php

use App\Enums\ParkingStatus;
use App\Enums\UserRole;
use App\Jobs\ProcessDatasetDelivery;
use App\Models\Country;
use App\Models\DatasetDelivery;
use App\Models\DatasetSource;
use App\Models\LocationProposalDecision;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingSpace;
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

it('lists proposals with parking within 3 m first, across both sources, and keeps next in id order', function () {
    $data = proposalEnvelope([proposalPoint(), proposalPoint(longitude: 4.361), proposalPoint(longitude: 4.362)]);
    $source = app(SourceRegistrar::class)->register('proposals', $data);
    app(SourceRegistrar::class)->approve($source, User::factory()->create()->assignRole(UserRole::ADMIN), null);
    expect(processProposalObject($this->handler, $source, $data)->state)->toBe('validated');

    [$first, $second, $third] = DB::table('location_proposals')->orderBy('id')->pluck('id')->all();
    $municipality = Municipality::where('code', 'GM0503')->sole();
    $nearby = ['municipality_id' => $municipality->id, 'latitude' => 52.01];
    ParkingMunicipal::factory()->create([...$nearby, 'longitude' => 4.36002, 'visibility' => true, 'street' => 'Markt']);
    ParkingMunicipal::factory()->create([...$nearby, 'longitude' => 4.361, 'visibility' => false]);
    ParkingSpace::factory()->create([...$nearby, 'longitude' => 4.361, 'status' => ParkingStatus::PENDING]);
    ParkingSpace::factory()->create([...$nearby, 'longitude' => 4.36105, 'status' => ParkingStatus::APPROVED]);
    ParkingSpace::factory()->create([...$nearby, 'longitude' => 4.36202, 'status' => ParkingStatus::APPROVED]);

    $moderator = User::factory()->create()->assignRole(UserRole::MODERATOR);
    $url = fn (array $query) => route('app.moderation.proposals.index', ['municipality' => $municipality->id, ...$query]);
    $this->actingAs($moderator)->get($url([]))->assertInertia(fn (Assert $page) => $page
        ->where('proposals.total', 3)->where('onMapCount', 2)
        ->where('proposals.data.0.id', $first)
        ->where('proposals.data.0.points.0.overlap.source', 'municipal')
        ->where('proposals.data.0.points.0.overlap.street', 'Markt')
        ->where('proposals.data.0.points.0.overlap.distance_metres', 1.4)
        ->where('proposals.data.1.id', $third)
        ->where('proposals.data.1.points.0.overlap.source', 'community')
        ->where('proposals.data.2.id', $second)
        ->missing('proposals.data.2.points.0.overlap'));
    $this->get($url(['after' => $first]))->assertRedirect($url(['proposal' => $second]));
});

it('keeps a proposal closed as a duplicate when the same NDW point is updated, absent and returned', function (string $target) {
    $point = proposalPoint();
    $otherPoints = array_map(fn () => proposalPoint('GM0363', longitude: 4.9), range(1, 4));
    $data = proposalEnvelope([$point, ...$otherPoints], 4);
    $source = app(SourceRegistrar::class)->register('proposals', $data);
    app(SourceRegistrar::class)->approve($source, User::factory()->create()->assignRole(UserRole::ADMIN), null);
    expect(processProposalObject($this->handler, $source, $data)->state)->toBe('validated');

    $municipality = Municipality::where('code', 'GM0503')->sole();
    $location = ['municipality_id' => $municipality->id, 'latitude' => 52.01, 'longitude' => 4.36002];
    $existing = $target === 'municipal'
        ? ParkingMunicipal::factory()->create([...$location, 'visibility' => true])
        : ParkingSpace::factory()->create([...$location, 'status' => ParkingStatus::APPROVED]);
    $field = $target === 'municipal' ? 'existing_parking_municipal_id' : 'existing_parking_space_id';
    $proposal = DB::table('location_proposal_points')->where('external_id', $point['external_id'])->value('location_proposal_id');
    $moderator = User::factory()->create()->assignRole(UserRole::MODERATOR);
    $url = route('app.moderation.proposals.index', ['municipality' => $municipality->id]);

    $this->actingAs($moderator)->get(route('app.moderation.proposals.index', ['proposal' => $proposal]))
        ->assertInertia(fn (Assert $page) => $page->where("selected.{$target}.0.possible_duplicate", true));
    $this->post(route('app.moderation.proposals.duplicates.close'), ['proposals' => [$proposal]])->assertRedirect();
    $this->assertDatabaseHas('location_proposal_decisions', ['location_proposal_id' => $proposal, 'reason' => 'duplicate', $field => $existing->id]);

    $point['source_last_seen_on'] = '2026-11-02';
    $point['geometry']['coordinates'][0] = 4.3601;
    foreach ([3 => [$point, ...$otherPoints], 2 => $otherPoints, 1 => [$point, ...$otherPoints]] as $hours => $points) {
        expect(processProposalObject($this->handler, $source, proposalEnvelope($points, $hours))->state)->toBe('validated');
        $this->get($url)->assertInertia(fn (Assert $page) => $page->where('proposals.total', 0));
    }

    $this->assertDatabaseHas('location_proposal_points', [
        'external_id' => $point['external_id'], 'location_proposal_id' => $proposal,
        'source_last_seen_on' => '2026-11-02', 'missing_since' => null,
    ]);
    expect(LocationProposalDecision::sole()->evidence)
        ->toMatchArray(['existing_id' => $existing->id, 'existing_source' => $target, 'marker_distance_metres' => 1.37]);
    $this->get(route('app.moderation.index', ['status' => 'decided', 'type' => 'proposal']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('history.data.0.proposal.existing_url', route('location-map', [
                'place' => "{$target}:{$existing->id}", 'at' => "{$existing->latitude},{$existing->longitude}",
            ]))
            ->where('history.data.0.proposal.reopen_revision', 1));
})->with(['municipal', 'community']);

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

it('queues nearby NDW signs separately and keeps their proposal IDs across deliveries', function () {
    [$first, $near, $far] = [proposalPoint(), proposalPoint(longitude: 4.3601), proposalPoint(longitude: 4.361)];
    $data = proposalEnvelope([$first, $near, $far], 2);
    $source = app(SourceRegistrar::class)->register('proposals', $data);
    app(SourceRegistrar::class)->approve($source, User::factory()->create()->assignRole(UserRole::ADMIN), null);
    expect(processProposalObject($this->handler, $source, $data)->state)->toBe('validated');
    $proposalOf = fn (array $point) => DB::table('location_proposal_points')->where('external_id', $point['external_id'])->value('location_proposal_id');
    $ids = array_map($proposalOf, $data['records']);
    expect(array_unique($ids))->toHaveCount(3);

    $this->actingAs(User::factory()->create()->assignRole(UserRole::MODERATOR));
    expect(processProposalObject($this->handler, $source, proposalEnvelope($data['records']))->state)->toBe('validated');
    expect(array_map($proposalOf, $data['records']))->toBe($ids);
    foreach ($data['records'] as $index => $point) {
        $this->get(route('app.moderation.proposals.index', ['proposal' => $ids[$index]]))
            ->assertInertia(fn (Assert $page) => $page->where('proposals.total', 3)->has('selected.points', 1)
                ->where('selected.points.0.external_id', $point['external_id']));
    }
});

it('splits unreviewed groups without moving the signs of historical decisions or published bays', function () {
    $data = proposalEnvelope(array_map(fn (int $index) => proposalPoint(longitude: 4.36 + $index * 0.00001), range(0, 5)), 2);
    $source = app(SourceRegistrar::class)->register('proposals', $data);
    app(SourceRegistrar::class)->approve($source, User::factory()->create()->assignRole(UserRole::ADMIN), null);
    expect(processProposalObject($this->handler, $source, $data)->state)->toBe('validated');
    $points = fn () => DB::table('location_proposal_points')->where('dataset_source_id', $source->id)->orderBy('id')->get();
    [$anchor, $nearby, $missing, $reviewed, $reviewedPoint, $publishedPoint] = $points()->pluck('id')->all();

    DB::table('location_proposal_points')->whereIn('id', [$nearby, $missing])->update(['location_proposal_id' => $anchor]);
    DB::table('location_proposal_points')->where('id', $missing)->update(['missing_since' => now(), 'municipality_id' => null]);
    DB::table('location_proposals')->where('id', $missing)->delete();
    DB::table('location_proposal_points')->whereIn('id', [$reviewedPoint, $publishedPoint])->update(['location_proposal_id' => $reviewed]);
    DB::table('location_proposals')->where('id', $reviewed)->update(['decision_revision' => 2]);
    $decision = LocationProposalDecision::factory()->create(['location_proposal_id' => $reviewed]);
    $bay = ParkingSpace::factory()->create([
        'location_proposal_id' => $reviewed, 'location_proposal_point_id' => $publishedPoint, 'location_proposal_bay_number' => 1,
    ]);

    $migration = require database_path('migrations/2026_11_09_171541_split_unreviewed_location_proposal_groups.php');
    $migration->up();
    $migration->up();

    expect($points()->pluck('location_proposal_id')->all())->toBe([$anchor, $nearby, $missing, $reviewed, $reviewed, $reviewed]);
    expect($points()->pluck('external_id')->all())->toBe(array_column($data['records'], 'external_id'));
    $this->assertDatabaseHas('location_proposal_decisions', ['id' => $decision->id, 'location_proposal_id' => $reviewed]);
    $this->assertDatabaseHas('parking_spaces', ['id' => $bay->id, 'location_proposal_id' => $reviewed, 'location_proposal_point_id' => $publishedPoint]);

    $this->actingAs(User::factory()->create()->assignRole(UserRole::MODERATOR))
        ->postJson(route('app.moderation.proposals.reject', ['proposal' => $anchor, 'point' => $nearby]), [
            'revision' => 0, 'reason' => 'not_a_disabled_bay',
        ])->assertJsonValidationErrors('decision');
    expect(processProposalObject($this->handler, $source, proposalEnvelope($data['records']))->state)->toBe('validated');
    expect($points()->pluck('location_proposal_id')->all())->toBe([$anchor, $nearby, $missing, $reviewed, $reviewed, $reviewed]);
});

it('leaves a decided proposal alone when a new sign appears next to it', function () {
    $first = proposalPoint();
    $data = proposalEnvelope([$first], 2);
    $source = app(SourceRegistrar::class)->register('proposals', $data);
    app(SourceRegistrar::class)->approve($source, User::factory()->create()->assignRole(UserRole::ADMIN), null);
    expect(processProposalObject($this->handler, $source, $data)->state)->toBe('validated');
    $closed = DB::table('location_proposal_points')->where('external_id', $first['external_id'])->value('location_proposal_id');
    DB::table('location_proposals')->where('id', $closed)->update(['closed_at' => now(), 'decision_revision' => 1]);

    $next = proposalPoint(longitude: 4.3601);
    expect(processProposalObject($this->handler, $source, proposalEnvelope([$first, $next]))->state)->toBe('validated');
    expect(DB::table('location_proposal_points')->where('external_id', $next['external_id'])->value('location_proposal_id'))->not->toBe($closed);
    expect(DB::table('location_proposal_points')->where('location_proposal_id', $closed)->count())->toBe(1);
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
    [$first, $amsterdam, $nearby, $closed, $missing, $last] = collect($data['records'])->map(fn (array $point) => DB::table('location_proposal_points')
        ->where('external_id', $point['external_id'])->value('location_proposal_id'))->all();
    $delftId = Municipality::where('code', 'GM0503')->value('id');
    $amsterdamId = Municipality::where('code', 'GM0363')->value('id');
    DB::table('location_proposal_points')->where('location_proposal_id', $missing)->update(['missing_since' => now()]);
    DB::table('location_proposals')->where('id', $closed)->update(['closed_at' => now()]);

    $moderator = User::factory()->create()->assignRole(UserRole::MODERATOR);
    $route = fn (array $query = []) => route('app.moderation.proposals.index', $query);
    expect($nearby)->not->toBe($first);
    $this->actingAs($moderator);
    $this->get($route())->assertInertia(fn (Assert $page) => $page
        ->where('proposals', null)->where('municipality', null)
        ->where('municipalities', [
            ['id' => $amsterdamId, 'name' => 'Amsterdam', 'open_count' => 1, 'point' => ['latitude' => 52.01, 'longitude' => 4.9]],
            ['id' => $delftId, 'name' => 'Delft', 'open_count' => 3, 'point' => ['latitude' => 52.01, 'longitude' => 4.36]],
        ]));
    $this->get($route(['municipality' => $delftId]))
        ->assertCookie('proposal_municipality_'.$moderator->id, (string) $delftId)
        ->assertInertia(fn (Assert $page) => $page->where('proposals.total', 3)->where('municipalityName', 'Delft')->where('hasNext', true));
    $this->withCookie('proposal_municipality_'.$moderator->id, (string) $delftId)
        ->get($route())->assertRedirect($route(['municipality' => $delftId]));
    $this->get($route(['overview' => 1]))->assertInertia(fn (Assert $page) => $page->where('municipality', null));

    $this->get($route(['municipality' => $delftId, 'after' => 0]))
        ->assertRedirect($route(['municipality' => $delftId, 'proposal' => $first]));
    $this->get($route(['municipality' => $delftId, 'after' => $first]))
        ->assertRedirect($route(['municipality' => $delftId, 'proposal' => $nearby]));
    $this->get($route(['municipality' => $delftId, 'after' => $nearby]))
        ->assertRedirect($route(['municipality' => $delftId, 'proposal' => $last]));
    $this->get($route(['municipality' => $delftId, 'after' => $last]))
        ->assertRedirect($route(['municipality' => $delftId, 'proposal' => $first]));
    $this->get($route(['municipality' => $amsterdamId, 'after' => $amsterdam]))
        ->assertRedirect($route(['municipality' => $amsterdamId]));
    $this->get($route(['proposal' => $amsterdam]))->assertInertia(fn (Assert $page) => $page
        ->where('municipality', $amsterdamId)->where('hasNext', false));
});
