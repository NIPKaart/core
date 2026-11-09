<?php

use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingStatus;
use App\Enums\UserRole;
use App\Models\Country;
use App\Models\DatasetSource;
use App\Models\Municipality;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceConfirmation;
use App\Models\Province;
use App\Models\User;
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

it('publishes all bays with an attributable approval and existence confirmation and safely repeats the request', function () {
    fakeReverseGeocoding($this->municipality);
    $this->freezeSecond();

    $this->actingAs($this->moderator)->get(route('app.moderation.index'))->assertInertia(fn (Assert $page) => $page
        ->where('locationProposals.0.id', $this->proposal)->where('locationProposals.0.status', 'open'));
    $this->post($this->url, $this->payload)->assertRedirect($this->detail);
    $this->post($this->url, $this->payload)->assertRedirect($this->detail);
    $this->get($this->detail)->assertInertia(fn (Assert $page) => $page
        ->where('proposals.data.0.status', 'added')->where('selected.published', true)->has('selected.publishedBays', 3)
        ->where('selected.publishedBays.0.number', 1)->where('selected.publishedBays.2.number', 3));
    $this->get(route('app.moderation.index'))->assertInertia(fn (Assert $page) => $page->where('items.total', 0));

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
