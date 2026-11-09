<?php

use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingStatus;
use App\Enums\UserRole;
use App\Models\Country;
use App\Models\DatasetSource;
use App\Models\LocationProposalDecision;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceConfirmation;
use App\Models\ParkingSpaceReview;
use App\Models\Province;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Notification::fake();
    $this->moderator = User::factory()->create()->assignRole(UserRole::MODERATOR);
    $country = Country::factory()->create(['code' => 'NL']);
    $province = Province::factory()->for($country)->create(['geocode' => 'NL-ZH', 'name' => 'Zuid-Holland']);
    $this->municipality = Municipality::factory()->for($country)->for($province)->create([
        'name' => 'Delft', 'code' => 'GM0503', 'code_scheme' => 'nl-cbs',
    ]);
    $source = DatasetSource::factory()->create([
        'target_type' => 'proposals', 'code' => 'nl-ndw-e6', 'municipality_id' => null,
        'approval_state' => 'approved', 'description' => ['area' => ['country' => 'NL']],
    ]);
    $this->proposal = DB::table('location_proposal_points')->insertGetId([
        'dataset_source_id' => $source->id, 'external_id' => (string) Str::uuid(),
        'municipality_id' => $this->municipality->id, 'municipality_code' => 'GM0503',
        'latitude' => 52.011, 'longitude' => 4.36, 'under_sign_types' => '[]', 'personal' => false,
        'last_seen_at' => now(),
    ]);
    DB::table('location_proposals')->insert(['id' => $this->proposal, 'municipality_id' => $this->municipality->id, 'created_at' => now()]);
    DB::table('location_proposal_points')->where('id', $this->proposal)->update(['location_proposal_id' => $this->proposal]);
    $this->payload = [
        'bays' => [
            ['latitude' => 52.011, 'longitude' => 4.36001, 'source_point_id' => $this->proposal],
            ['latitude' => 52.01101, 'longitude' => 4.36002, 'source_point_id' => $this->proposal],
            ['latitude' => 52.01102, 'longitude' => 4.36003, 'source_point_id' => $this->proposal],
        ],
        'orientation' => 'parallel', 'under_sign' => 'yes', 'parking_hours' => 1, 'parking_minutes' => 30,
        'under_sign_text' => 'Max. 90 min', 'description' => 'Shared details',
    ];
    $this->url = route('app.moderation.proposals.publish', $this->proposal);
    $this->detail = route('app.moderation.proposals.index', ['proposal' => $this->proposal]);
});

it('shows multiple nearby municipal and community spaces on opening a proposal', function () {
    $location = ['municipality_id' => $this->municipality->id, 'latitude' => 52.011];
    $municipal = ParkingMunicipal::factory()->state([...$location, 'visibility' => true]);
    $community = ParkingSpace::factory()->state([...$location, 'status' => ParkingStatus::APPROVED]);

    $fartherMunicipal = $municipal->create(['longitude' => 4.3603]);
    $nearestMunicipal = $municipal->create(['longitude' => 4.3601]);
    $municipal->create(['longitude' => 4.36, 'visibility' => false]);
    $municipal->create(['longitude' => 4.37]);

    $fartherCommunity = $community->create(['longitude' => 4.3604]);
    $nearestCommunity = $community->create(['longitude' => 4.3602]);
    $community->create(['longitude' => 4.36, 'status' => ParkingStatus::PENDING]);
    $community->create(['longitude' => 4.37]);

    $this->actingAs($this->moderator)->get($this->detail)->assertInertia(fn (Assert $page) => $page
        ->has('selected.municipal', 2)
        ->where('selected.municipal.0.id', $nearestMunicipal->id)
        ->where('selected.municipal.1.id', $fartherMunicipal->id)
        ->has('selected.community', 2)
        ->where('selected.community.0.id', $nearestCommunity->id)
        ->where('selected.community.1.id', $fartherCommunity->id));
});

it('publishes all bays with an attributable approval and existence confirmation and safely repeats the request', function () {
    fakeReverseGeocoding($this->municipality);
    $this->freezeSecond();

    $this->actingAs($this->moderator)->get(route('app.moderation.index'))->assertInertia(fn (Assert $page) => $page
        ->where('locationProposals.0.id', $this->proposal)->where('locationProposals.0.status', 'open'));
    $this->post($this->url, $this->payload)->assertRedirect($this->detail);
    $this->post($this->url, $this->payload)->assertRedirect($this->detail);
    $this->postJson($this->url, [...$this->payload, 'bays' => array_slice($this->payload['bays'], 0, 1)])
        ->assertJsonValidationErrors('decision');
    $this->get($this->detail)->assertInertia(fn (Assert $page) => $page
        ->has('proposals.data', 0)->where('selected.published', true)->has('selected.publishedBays', 3)
        ->where('selected.publishedBays.0.number', 1)->where('selected.publishedBays.2.number', 3));
    $this->get(route('app.moderation.index'))->assertInertia(fn (Assert $page) => $page->where('items.total', 0)->has('locationProposals', 0));

    $spaces = ParkingSpace::with(['reviews', 'confirmations'])->get();
    expect($spaces)->toHaveCount(3);
    foreach ($spaces as $space) {
        expect($space)->status->toBe(ParkingStatus::APPROVED)
            ->location_proposal_id->toBe($this->proposal)
            ->location_proposal_point_id->toBe($this->proposal)
            ->municipality_id->toBe($this->municipality->id)
            ->parking_time->toBe(90)->description->toBe('Shared details');
        expect($space->reviews->sole())->reviewed_by->toBe($this->moderator->id)
            ->from_status->toBeNull()->to_status->toBe(ParkingStatus::APPROVED)
            ->reviewed_at->toEqual(now());
        expect($space->confirmations->sole())->user_id->toBe($this->moderator->id)
            ->status->toBe(ParkingConfirmationStatus::CONFIRMED)->confirmed_at->toEqual(now());
    }
    $this->assertDatabaseCount('community_point_events', 0);
    Notification::assertNothingSent();

    auth()->forgetGuards();
    $this->getJson(route('map.parking.nearby', ['latitude' => 52.011, 'longitude' => 4.36, 'source' => 'community']))
        ->assertOk()->assertJsonCount(3, 'results');
    $this->getJson(route('map.parking-spaces.show', $spaces->first()->id))
        ->assertOk()->assertJsonPath('confirmations_count.confirmed', 1);
});

it('refuses the entire batch when a bay references a foreign, missing or distant source point', function () {
    $this->payload['bays'][1]['source_point_id'] = $this->proposal + 1;
    $this->actingAs($this->moderator)->postJson($this->url, $this->payload)
        ->assertUnprocessable()->assertJsonValidationErrors('bays.1.latitude');
    $this->assertDatabaseCount('parking_spaces', 0);
    $this->assertDatabaseCount('parking_space_reviews', 0);
    $this->assertDatabaseCount('parking_space_confirmations', 0);
    $this->assertDatabaseHas('location_proposals', ['id' => $this->proposal, 'bays_published_at' => null]);
    Http::assertNothingSent();
});

it('rejects duplicate coordinates and unauthorized publication', function () {
    $this->actingAs(User::factory()->create())->postJson($this->url, $this->payload)->assertForbidden();
    $this->payload['bays'][1] = $this->payload['bays'][0];
    $this->actingAs($this->moderator)->postJson($this->url, $this->payload)
        ->assertUnprocessable()->assertJsonValidationErrors('bays.1.latitude');
    $this->assertDatabaseCount('parking_spaces', 0);
    Http::assertNothingSent();
});

it('rolls back already written bays and approvals if a confirmation fails', function () {
    fakeReverseGeocoding($this->municipality);
    $confirmations = 0;
    ParkingSpaceConfirmation::creating(function () use (&$confirmations): void {
        if (++$confirmations === 2) {
            throw ValidationException::withMessages(['bays' => 'Confirmation failed.']);
        }
    });

    $this->actingAs($this->moderator)->postJson($this->url, $this->payload)
        ->assertUnprocessable()->assertJsonValidationErrors('bays');
    $this->assertDatabaseCount('parking_spaces', 0);
    $this->assertDatabaseCount('parking_space_reviews', 0);
    $this->assertDatabaseCount('parking_space_confirmations', 0);
    $this->assertDatabaseHas('location_proposals', ['id' => $this->proposal, 'bays_published_at' => null]);
    Notification::assertNothingSent();
});

it('stores partial decisions and records a new decision when more bays are added after reopening', function () {
    fakeReverseGeocoding($this->municipality);
    DB::table('location_proposals')->where('id', $this->proposal)->update(['reported_bays' => 4]);
    DB::table('location_proposal_points')->where('id', $this->proposal)->update(['source_last_seen_on' => '2026-10-01']);
    $this->actingAs($this->moderator)->postJson($this->url, $this->payload)->assertJsonValidationErrors('reason');
    $this->assertDatabaseCount('parking_spaces', 0);
    $this->post($this->url, [...$this->payload, 'revision' => 0, 'reason' => 'not_visible', 'note' => 'Tree obscures the bay'])
        ->assertRedirect($this->detail);
    ParkingSpaceReview::factory()->create([
        'reviewed_by' => $this->moderator->id,
        'reviewed_at' => now()->subMinute(),
    ]);
    $this->get(route('app.moderation.index', ['status' => 'decided']))->assertInertia(fn (Assert $page) => $page
        ->has('history.data', 2)->where('history.data.0.type', 'proposal')->where('history.data.1.type', 'submission'));
    $history = route('app.moderation.index', ['status' => 'decided', 'type' => 'proposal']);
    $this->get($history)->assertInertia(fn (Assert $page) => $page
        ->where('history.data.0.type', 'proposal')->where('history.data.0.decision', 'completed')
        ->where('history.data.0.note', 'Tree obscures the bay')->where('history.data.0.reviewer', $this->moderator->name)
        ->where('history.data.0.proposal.reported_bays', 4)->where('history.data.0.proposal.last_seen_on', '2026-10-01')
        ->has('history.data.0.proposal.bays', 3)->where('history.data.0.proposal.reopen_revision', 1)
        ->where('history.data.0.latitude', 52.011)->where('history.data.0.longitude', 4.36001));

    $this->post(route('app.moderation.proposals.reopen', $this->proposal), ['revision' => 1])->assertRedirect($this->detail);
    $this->get(route('app.moderation.index'))->assertInertia(fn (Assert $page) => $page->where('locationProposals.0.id', $this->proposal));
    $this->postJson($this->url, [...$this->payload, 'revision' => 0])->assertJsonValidationErrors('decision');
    $this->travel(1)->seconds();
    $this->post($this->url, [...$this->payload, 'revision' => 2, 'bays' => [
        ['latitude' => 52.01103, 'longitude' => 4.36004, 'source_point_id' => $this->proposal],
    ]])->assertRedirect($this->detail);
    expect(ParkingSpace::where('location_proposal_id', $this->proposal)->count())->toBe(4);
    $this->get($history)->assertInertia(fn (Assert $page) => $page
        ->has('history.data', 2)->where('history.data.0.proposal.total_bays', 4)
        ->has('history.data.0.proposal.bays', 1)->where('history.data.0.proposal.bays.0.number', 4)
        ->where('history.data.1.proposal.total_bays', 3)->where('history.data.1.proposal.reopen_revision', null));
});

it('rejects a proposal with an attributable decision and requires a public space for duplicates', function (string $reason) {
    $url = route('app.moderation.proposals.reject', $this->proposal);
    $payload = ['revision' => 0, 'reason' => $reason, 'note' => 'Reviewed on the map'];
    $existing = null;
    $this->actingAs($this->moderator);
    if ($reason === 'duplicate') {
        $this->postJson($url, $payload)->assertJsonValidationErrors('existing_parking_space_id');
        $space = ParkingSpace::factory()->create(['latitude' => 52.011, 'longitude' => 4.36001, 'status' => ParkingStatus::PENDING]);
        $payload['existing_parking_space_id'] = $space->id;
        $this->postJson($url, $payload)->assertJsonValidationErrors('existing_parking_space_id');
        $space->update(['status' => ParkingStatus::APPROVED]);
        $existing = $space->id;
    }
    $this->post($url, $payload)->assertRedirect(route('app.moderation.proposals.index'));
    $this->postJson($url, $payload)->assertJsonValidationErrors('decision');
    $this->assertDatabaseHas('location_proposal_decisions', [
        'location_proposal_id' => $this->proposal, 'outcome' => 'rejected', 'reason' => $reason,
        'moderator_id' => $this->moderator->id, 'existing_parking_space_id' => $existing,
    ]);
    $this->get(route('app.moderation.index'))->assertInertia(fn (Assert $page) => $page->has('locationProposals', 0));
    $this->get(route('app.moderation.index', ['status' => 'decided', 'type' => 'proposal']))->assertInertia(fn (Assert $page) => $page
        ->where('history.data.0.decision', 'rejected')
        ->where('history.data.0.latitude', 52.011)->where('history.data.0.longitude', $existing === null ? 4.36 : 4.36001)
        ->where('history.data.0.proposal.existing_url', $existing === null ? null : fn (string $url) => str_contains($url, $existing)));
})->with(['not_a_disabled_bay', 'duplicate']);

it('backfills an existing publication with its original moderator, timestamp and under-sign details', function () {
    $migration = require database_path('migrations/2026_11_09_004927_create_location_proposal_decisions_table.php');
    $migration->down();

    $publishedAt = Carbon::parse('2026-11-08T19:15:00+01:00');
    DB::table('location_proposals')->where('id', $this->proposal)->update([
        'bays_published_at' => $publishedAt->toIso8601String(),
    ]);
    $bay = ParkingSpace::factory()->create([
        'orientation' => 'parallel',
        'under_sign' => 'yes',
        'under_sign_text' => 'Max. 90 min',
        'parking_time' => 90,
        'restriction_days' => ['mon'],
        'restriction_starts_at' => '09:00',
        'restriction_ends_at' => '18:00',
        'status' => ParkingStatus::APPROVED,
    ]);
    $bay->forceFill([
        'location_proposal_id' => $this->proposal,
        'location_proposal_point_id' => $this->proposal,
        'location_proposal_bay_number' => 1,
    ])->save();
    $bay->reviews()->create([
        'reviewed_by' => $this->moderator->id,
        'from_status' => null,
        'to_status' => ParkingStatus::APPROVED,
        'reviewed_at' => $publishedAt->copy()->utc(),
    ]);

    $migration->up();

    $decision = LocationProposalDecision::sole();
    expect($decision)->moderator_id->toBe($this->moderator->id)
        ->outcome->toBe('completed')
        ->decided_at->toEqual($publishedAt);
    expect($decision->evidence)->toMatchArray([
        'under_sign' => 'yes',
        'restriction' => 'Max. 90 min',
        'parking_time' => 90,
        'restriction_days' => ['mon'],
        'restriction_starts_at' => '09:00:00',
        'restriction_ends_at' => '18:00:00',
        'bays' => [['id' => $bay->id, 'number' => 1]],
    ]);
    expect(Carbon::parse(DB::table('location_proposals')->find($this->proposal)->closed_at))->toEqual($publishedAt);
});
