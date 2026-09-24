<?php

use App\Enums\UserRole;
use App\Models\DatasetSource;
use App\Models\MunicipalDelivery;
use App\Models\MunicipalImport;
use App\Models\ParkingMunicipal;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('exposes only reviewed provenance and keeps an old source date distinct from a recent fetch', function () {
    $this->travelTo(now()->setDate(2026, 9, 24)->startOfDay());
    $source = DatasetSource::factory()->create();
    $import = MunicipalImport::factory()->for($source)->create(['state' => 'published', 'reviewed_at' => now(), 'retrieved_at' => now()->subHour()]);
    $space = ParkingMunicipal::factory()->create([
        'visibility' => true, 'dataset_source_id' => $source->id, 'published_import_id' => $import->id,
        'source_record' => ['source_updated_at' => '2020-01-01T00:00:00Z', 'private' => 'DO NOT EXPOSE'],
    ]);
    MunicipalDelivery::factory()->create(['dataset_source_id' => $source->id, 'municipal_import_id' => $import->id, 'bucket' => 'PRIVATE BUCKET']);
    $source->update(['name' => 'UNREVIEWED NAME']);
    MunicipalImport::factory()->for($source)->create(['retrieved_at' => now()]);

    $response = $this->getJson('/api/parking-municipal/'.$space->id)->assertOk();

    $response->assertJsonPath('provenance', [
        'name' => 'Amsterdam', 'attribution' => 'Gemeente Amsterdam — CC0',
        'url' => $import->dataset_config['source_url'], 'terms_url' => $import->dataset_config['terms_url'],
        'fetched_at' => '2026-09-23T23:00:00.000000Z', 'source_updated_at' => '2020-01-01T00:00:00Z',
    ])->assertDontSee('DO NOT EXPOSE')->assertDontSee('PRIVATE BUCKET')->assertDontSee('UNREVIEWED NAME');
    expect($response->json('provenance'))->not->toHaveKey('delivery_status');
});

it('does not invent provenance for legacy or unpublished records', function (?string $state) {
    $source = DatasetSource::factory()->create();
    $import = $state ? MunicipalImport::factory()->for($source)->create(['state' => $state]) : null;
    $space = ParkingMunicipal::factory()->create(['visibility' => true, 'dataset_source_id' => $source->id, 'published_import_id' => $import?->id]);

    $this->getJson('/api/parking-municipal/'.$space->id)->assertOk()->assertJsonPath('provenance', [
        'name' => null, 'attribution' => null, 'url' => null, 'terms_url' => null, 'fetched_at' => null, 'source_updated_at' => null,
    ]);
    $space->update(['visibility' => false]);
    $this->getJson('/api/parking-municipal/'.$space->id)->assertNotFound();
})->with([null, 'pending', 'rejected']);

it('does not expose credential-bearing or executable source links', function (string $url) {
    $source = DatasetSource::factory()->create(['source_url' => $url, 'terms_url' => $url]);
    $import = MunicipalImport::factory()->for($source)->create(['state' => 'published']);
    $space = ParkingMunicipal::factory()->create(['visibility' => true, 'dataset_source_id' => $source->id, 'published_import_id' => $import->id]);

    $this->getJson('/api/parking-municipal/'.$space->id)->assertJsonPath('provenance.url', null)->assertJsonPath('provenance.terms_url', null)->assertDontSee('SECRET');
})->with(['https://user:SECRET@example.com/data', 'https://example.com/data?token=SECRET', 'javascript:SECRET', 'https://example.com/data#SECRET']);

it('marks never delivered sources overdue and recovers only when a recent valid import exists', function () {
    $this->freezeTime();
    $source = DatasetSource::factory()->create(['created_at' => now()->subHours(49)]);
    $admin = User::factory()->create();
    $admin->assignRole(UserRole::ADMIN);
    $this->actingAs($admin)->get(route('app.municipal-imports.index'))->assertInertia(fn (Assert $page) => $page
        ->where('datasets.0.delivery_status', 'overdue')->where('datasets.0.stale', true));

    MunicipalDelivery::factory()->create(['dataset_source_id' => $source->id, 'state' => 'rejected', 'received_at' => now()]);
    $this->get(route('app.municipal-imports.index'))->assertInertia(fn (Assert $page) => $page->where('datasets.0.stale', true));

    MunicipalImport::factory()->for($source)->create(['retrieved_at' => now()->subHours(49)]);
    $this->get(route('app.municipal-imports.index'))->assertInertia(fn (Assert $page) => $page->where('datasets.0.stale', true));
    MunicipalImport::factory()->for($source)->create(['retrieved_at' => now()]);
    $this->get(route('app.municipal-imports.index'))->assertInertia(fn (Assert $page) => $page
        ->where('datasets.0.delivery_status', 'current')->where('datasets.0.stale', false));
    $this->travel(49)->hours();
    $this->get(route('app.municipal-imports.index'))->assertInertia(fn (Assert $page) => $page->where('datasets.0.stale', true));
});

it('distinguishes awaiting deliveries from unknown cadence', function () {
    DatasetSource::factory()->create();
    $admin = User::factory()->create();
    $admin->assignRole(UserRole::ADMIN);
    $this->actingAs($admin)->get(route('app.municipal-imports.index'))->assertInertia(fn (Assert $page) => $page
        ->where('datasets.0.delivery_status', 'awaiting')->where('datasets.0.stale', false));
    config(['municipal-deliveries.sources' => []]);
    $this->get(route('app.municipal-imports.index'))->assertInertia(fn (Assert $page) => $page
        ->where('datasets.0.delivery_status', 'unknown')->where('datasets.0.stale', false));
});

it('shows separate fetch receipt validation staging and publication times only to import reviewers', function () {
    $this->travelTo(now()->startOfSecond());
    $source = DatasetSource::factory()->create();
    $import = MunicipalImport::factory()->for($source)->create(['retrieved_at' => now()->subHours(5), 'created_at' => now()->subHours(2), 'state' => 'published', 'reviewed_at' => now()->subHour()]);
    $delivery = MunicipalDelivery::factory()->create([
        'dataset_source_id' => $source->id, 'municipal_import_id' => $import->id,
        'received_at' => now()->subHours(3), 'validated_at' => now()->subHours(2), 'state' => 'validated',
    ]);
    $admin = User::factory()->create();
    $admin->assignRole(UserRole::ADMIN);
    $this->actingAs($admin)->get(route('app.municipal-imports.show', $import))->assertInertia(fn (Assert $page) => $page
        ->where('times.fetched_at', $import->retrieved_at->toISOString())
        ->where('times.received_at', $delivery->received_at->toISOString())
        ->where('times.validated_at', $delivery->validated_at->toISOString())
        ->where('times.staged_at', $import->created_at->toISOString())
        ->where('times.published_at', $import->reviewed_at->toISOString()));
    $this->actingAs(User::factory()->create())->get(route('app.municipal-imports.show', $import))->assertForbidden();
});
