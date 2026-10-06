<?php

use App\Enums\UserRole;
use App\Models\DatasetDelivery;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\ParkingOffstreet;
use App\Models\User;
use App\Services\SourceOverview;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->create();
    $this->admin->assignRole(UserRole::ADMIN);
});

/** One source per status that needs no delivery storage, sharing Amsterdam as municipality. */
function overviewSources(): array
{
    $published = DatasetSource::factory()->create(['code' => 'published', 'name' => 'A Published', 'last_published_retrieved_at' => now()]);
    DatasetImport::factory()->for($published)->create(['state' => 'published', 'retrieved_at' => now()]);
    $state = fn (array $attributes) => DatasetSource::factory()->for($published->municipality)->create($attributes);

    return [
        'published' => $published,
        'awaiting_approval' => $state(['code' => 'new', 'name' => 'Z New', 'approval_state' => 'pending']),
        'rejected' => $state(['code' => 'rejected', 'name' => 'B Rejected', 'approval_state' => 'rejected']),
        'offstreet' => DatasetSource::factory()->offstreet()->for($published->municipality)->create(['name' => 'C Garages', 'approval_state' => 'pending']),
    ];
}

it('puts sources that need an administrator first and counts every status', function () {
    $this->freezeTime();
    $sources = overviewSources();

    $this->actingAs($this->admin)->get(route('app.imports.index'))->assertInertia(fn (Assert $page) => $page
        ->has('sources.data', 4)
        ->where('sources.data.0.name', 'C Garages')->where('sources.data.0.status', 'awaiting_approval')
        ->where('sources.data.1.name', 'Z New')
        ->where('sources.data.2.status', 'published')->where('sources.data.2.country', 'NL')->where('sources.data.2.subdivision_name', $sources['published']->municipality->province->name)->where('sources.data.2.municipality_code', 'GM0363')
        ->where('sources.data.3.status', 'rejected')
        ->where('summary.awaiting_approval', 2)->where('summary.published', 1)->where('summary.rejected', 1)->where('summary.total', 4)
        ->where('summary.processing', false)->where('countries', ['NL']));
});

it('filters sources by search, status, type and country', function (array $query, array $names) {
    $this->freezeTime();
    overviewSources();

    $this->actingAs($this->admin)->get(route('app.imports.index', $query))->assertInertia(fn (Assert $page) => $page
        ->where('sources.data', fn ($rows) => collect($rows)->pluck('name')->all() === $names)
        ->where('summary.total', 4));
})->with([
    'search by name' => [['search' => 'garages'], ['C Garages']],
    'search by municipality code' => [['search' => 'gm0363', 'status' => 'published'], ['A Published']],
    'attention' => [['status' => 'attention'], ['C Garages', 'Z New']],
    'single status' => [['status' => 'rejected'], ['B Rejected']],
    'type' => [['type' => 'offstreet'], ['C Garages']],
    'other country' => [['country' => 'be'], []],
]);

it('marks intake problems and processing deliveries', function () {
    $source = overviewSources()['published'];
    DatasetDelivery::factory()->create(['dataset_source_id' => $source->id, 'state' => 'pending']);

    $this->actingAs($this->admin)->get(route('app.imports.index', ['status' => 'published']))->assertInertia(fn (Assert $page) => $page
        ->where('sources.data.0.processing', true)->where('summary.processing', true));

    DatasetDelivery::factory()->create(['dataset_source_id' => $source->id, 'state' => 'rejected', 'error_code' => 'invalid_delivery']);
    $this->get(route('app.imports.index', ['status' => 'intake_problem']))->assertInertia(fn (Assert $page) => $page
        ->where('sources.data.0.name', 'A Published')->where('summary.intake_problem', 1));
});

it('pages the overview and clamps pages past the end', function () {
    $municipality = DatasetSource::factory()->create(['code' => 'source-0'])->municipality;
    DatasetSource::factory()->for($municipality)->count(26)->sequence(fn ($sequence) => ['code' => 'source-'.($sequence->index + 1)])->create();

    $this->actingAs($this->admin)->get(route('app.imports.index'))->assertInertia(fn (Assert $page) => $page
        ->has('sources.data', 25)->where('sources.total', 27)->where('sources.last_page', 2));
    $this->get(route('app.imports.index', ['page' => 9]))->assertInertia(fn (Assert $page) => $page
        ->has('sources.data', 2)->where('sources.current_page', 2));
});

it('rejects unknown overview filters', function (array $query) {
    $this->actingAs($this->admin)->get(route('app.imports.index', $query))->assertSessionHasErrors(array_keys($query));
})->with([[['status' => 'lost']], [['type' => 'bike']], [['country' => 'NLD']]]);

it('shares the attention count for the sidebar with admins only', function () {
    overviewSources();
    $this->actingAs($this->admin)->get(route('app.imports.index'))->assertInertia(fn (Assert $page) => $page
        ->where('counts.dataSources.attention', 2));

    $this->actingAs(User::factory()->create())->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->where('counts.dataSources.attention', 0));
});

it('labels each delivery in the history with its source type', function () {
    $source = DatasetSource::factory()->offstreet()->create();
    DatasetImport::factory()->for($source)->create();

    $this->actingAs($this->admin)->get(route('app.imports.index', ['tab' => 'deliveries']))->assertInertia(fn (Assert $page) => $page
        ->where('imports.data.0.dataset_source.target_type', 'offstreet'));
});

it('asks for attention when a garage source stops sending live measurements, without hiding its places', function () {
    $garages = DatasetSource::factory()->offstreet()->create(['name' => 'Garages']);
    $place = ParkingOffstreet::factory()->for($garages, 'datasetSource')->create(['visibility' => true, 'observed_at' => now()->subMinutes(2)]);
    $silent = DatasetSource::factory()->offstreet()->for($garages->municipality)->create(['code' => 'nl-utrecht-garages', 'name' => 'Stille garages']);
    ParkingOffstreet::factory()->for($silent, 'datasetSource')->create(['visibility' => true, 'observed_at' => now()->subMinutes(25)]);
    DatasetSource::factory()->offstreet()->for($garages->municipality)->create(['code' => 'nl-zwolle-garages', 'name' => 'Zonder live data']);

    $statuses = app(SourceOverview::class)->rows()->pluck('status', 'name');

    expect($statuses['Stille garages'])->toBe('live_stale')
        ->and($statuses['Garages'])->not->toBe('live_stale')
        ->and($statuses['Zonder live data'])->not->toBe('live_stale')
        ->and(SourceOverview::ATTENTION)->toContain('live_stale')
        ->and($place->fresh()->visibility)->toBeTrue();
});
