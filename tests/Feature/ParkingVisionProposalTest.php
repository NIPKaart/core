<?php

use App\Enums\UserRole;
use App\Models\DatasetSource;
use App\Models\Municipality;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['services.parking_vision' => ['url' => 'https://vision.test', 'key' => 'parking-vision-test-key']]);
    $this->moderator = User::factory()->create()->assignRole(UserRole::MODERATOR);
    $this->municipality = Municipality::factory()->create();
    $this->source = DatasetSource::factory()->create([
        'target_type' => 'proposals', 'code' => 'nl-ndw-e6', 'municipality_id' => null,
        'approval_state' => 'approved', 'description' => ['area' => ['country' => 'NL']],
    ]);
});

function parkingVisionProposal(int $municipality, int $source, string $externalId, float $lat, float $lon): array
{
    $point = DB::table('location_proposal_points')->insertGetId([
        'dataset_source_id' => $source, 'external_id' => $externalId,
        'municipality_id' => $municipality, 'municipality_code' => 'GM0503',
        'latitude' => $lat, 'longitude' => $lon, 'under_sign_types' => '[]', 'personal' => false, 'last_seen_at' => now(),
    ]);

    DB::table('location_proposals')->insert(['id' => $point, 'municipality_id' => $municipality, 'created_at' => now()]);
    DB::table('location_proposal_points')->where('id', $point)->update(['location_proposal_id' => $point]);

    return ['proposal' => $point, 'point' => $point];
}

it('returns independent evidence for the selected NDW point without changing the proposal', function (
    string $externalId, float $lat, float $lon, string $board, string $expectedBoard, array $images, int $analyzed, int $selected, string $subsign,
) {
    $params = parkingVisionProposal($this->municipality->id, $this->source->id, $externalId, $lat, $lon);
    $id = (string) Str::uuid();
    $locationId = "nipkaart:{$params['proposal']}:{$params['point']}";
    $url = 'https://vision.test/api/v1/validations';
    Http::preventStrayRequests();
    Http::fake([
        $url => Http::response(['id' => $id], 202),
        "$url/$id" => Http::sequence()
            ->push(['locationId' => $locationId, 'status' => 'running'])
            ->push([
                'locationId' => $locationId, 'status' => 'completed',
                'result' => [
                    'ndwProposalId' => $externalId,
                    'board' => ['status' => $board, 'linkedImageIds' => $images],
                    'bayCount' => ['status' => 'unknown', 'value' => null],
                    'bayGeometry' => ['status' => 'unknown', 'bays' => []],
                    'subsign' => ['status' => $subsign],
                    'sources' => ['mapillary' => ['analyzed' => $analyzed, 'selected' => $selected]],
                ],
            ]),
    ]);

    $this->actingAs($this->moderator)->get(route('app.moderation.proposals.index', $params))
        ->assertInertia(fn (Assert $page) => $page->where('selected.parkingVisionEnabled', true));
    $status = route('app.moderation.proposals.validation.show', $params);
    $start = route('app.moderation.proposals.validation.start', $params);
    $this->getJson($status)->assertOk()->assertExactJson(['status' => 'idle']);
    Http::assertNothingSent();

    $this->postJson($start)->assertOk()->assertExactJson(['status' => 'queued']);
    Http::assertSent(fn (Request $request) => $request->url() === $url
        && $request->hasHeader('Authorization', 'Bearer parking-vision-test-key')
        && $request->data() === ['locationId' => $locationId, 'ndwProposalId' => $externalId, 'lat' => $lat, 'lon' => $lon]);
    $this->postJson($start)->assertOk()->assertExactJson(['status' => 'running']);

    $expected = [
        'status' => 'completed', 'board' => $expectedBoard, 'linkedViews' => count($images),
        'bayCount' => null, 'mappedBays' => 0, 'subsign' => $subsign,
        'coverage' => ['analyzed' => $analyzed, 'selected' => $selected, 'partial' => $analyzed < $selected],
    ];
    $this->getJson($status)->assertOk()->assertExactJson($expected);
    $this->getJson($status)->assertOk()->assertExactJson($expected);
    Http::assertSentCount(3);
    $this->assertDatabaseHas('location_proposals', ['id' => $params['proposal'], 'closed_at' => null, 'bays_published_at' => null]);
})->with([
    'Staalweg' => ['edb41bee-2c01-421b-a614-e5897a55de0a', 52.0124914, 4.3744868, 'supported', 'supported', ['1', '2', '3', '4'], 12, 12, 'present'],
    'Kerkpolderpad' => ['909a2737-9961-4c45-8f97-015a0e2eefbf', 51.9931811, 4.3347200, 'not_observed', 'not_observed', [], 11, 11, 'unknown'],
    'incomplete imagery' => ['909a2737-9961-4c45-8f97-015a0e2eefbf', 51.9931811, 4.3347200, 'not_observed', 'inconclusive', [], 3, 11, 'unknown'],
    'no imagery' => ['909a2737-9961-4c45-8f97-015a0e2eefbf', 51.9931811, 4.3347200, 'not_observed', 'inconclusive', [], 0, 0, 'unknown'],
]);

it('rejects unauthorized and mismatched proposal points before calling Parking Vision', function () {
    Http::fake();
    $params = parkingVisionProposal($this->municipality->id, $this->source->id, (string) Str::uuid(), 52.01, 4.37);
    $other = parkingVisionProposal($this->municipality->id, $this->source->id, (string) Str::uuid(), 52.02, 4.38);
    $start = route('app.moderation.proposals.validation.start', $params);

    $this->actingAs(User::factory()->create())->postJson($start)->assertForbidden();
    $this->actingAs($this->moderator)->postJson(route('app.moderation.proposals.validation.start', [
        'proposal' => $params['proposal'], 'point' => $other['point'],
    ]))->assertNotFound();

    config(['services.parking_vision.key' => null]);
    $this->postJson($start)->assertNotFound();
    Http::assertNothingSent();
});

it('lets moderators retry after the provider rejects a submission', function () {
    $params = parkingVisionProposal($this->municipality->id, $this->source->id, (string) Str::uuid(), 52.01, 4.37);
    Http::fake(['https://vision.test/api/v1/validations' => Http::sequence()
        ->push(['error' => 'queue_full'], 429)
        ->push(['id' => (string) Str::uuid()], 202)]);

    $start = route('app.moderation.proposals.validation.start', $params);
    $this->actingAs($this->moderator)->postJson($start)->assertExactJson(['status' => 'unavailable']);
    $this->postJson($start)->assertExactJson(['status' => 'queued']);
});
