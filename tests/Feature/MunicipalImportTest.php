<?php

use App\Enums\UserRole;
use App\Models\DatasetSource;
use App\Models\Favorite;
use App\Models\MunicipalDelivery;
use App\Models\MunicipalImport;
use App\Models\ParkingMunicipal;
use App\Models\User;
use App\Services\MunicipalDeliveryStorage;
use App\Services\MunicipalImportService;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

function importReviewer(): User
{
    $user = User::factory()->create();
    $user->assignRole(UserRole::ADMIN);

    return $user;
}

function municipalDelivery(array $overrides = []): array
{
    return array_replace([
        'format' => 'nipkaart-municipal-pilot-1', 'dataset' => 'nl-amsterdam',
        'delivery_id' => (string) Str::uuid(), 'retrieved_at' => now()->subMinute()->utc()->format('Y-m-d\TH:i:s.u\Z'),
        'selection' => 'e6a-all', 'complete' => true, 'source_count' => 1,
        'records' => [[
            'external_id' => '000123', 'geometry' => ['type' => 'Polygon', 'coordinates' => [[[4.9, 52.3], [4.91, 52.3], [4.91, 52.31], [4.9, 52.31], [4.9, 52.3]]]],
            'number' => null, 'street' => 'Teststraat', 'access_category' => 'general',
            'source_attributes' => ['regimes' => [['eType' => 'E6a', 'eTypeDescription' => 'Gehandicaptenparkeerplaats algemeen', 'beginTijd' => '09:00:00', 'dagen' => ['ma']]], 'orientation' => 'Haaks', 'version_date' => '2026-09-01'],
            'source_updated_at' => null,
        ]],
    ], $overrides);
}

function stageMunicipal(array $data, User $user): MunicipalImport
{
    return app(MunicipalImportService::class)->intake(json_encode($data, JSON_THROW_ON_ERROR), $user);
}

function approveMunicipal(MunicipalImport $import, User $user): void
{
    $service = app(MunicipalImportService::class);
    $service->decide($import, $user, 'publish', 'Bronregelingen beoordeeld.', $service->review($import)['token']);
}

it('stages an authorized upload and publishes only after review', function () {
    $source = DatasetSource::factory()->create();
    $user = importReviewer();
    $data = municipalDelivery();
    $file = UploadedFile::fake()->createWithContent('delivery.json', json_encode($data));

    $this->mock(MunicipalDeliveryStorage::class)->shouldReceive('archive')->once();
    $this->actingAs($user)->post(route('app.municipal-imports.store'), ['file' => $file])->assertRedirect();
    $import = MunicipalImport::firstOrFail();
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
    $this->get(route('app.municipal-imports.show', $import))->assertInertia(fn (Assert $page) => $page->component('backend/municipal-imports/show')->where('review.counts.new', 1)->has('review.rows', 1));
    $review = app(MunicipalImportService::class)->review($import);
    $this->patch(route('app.municipal-imports.update', $import), ['decision' => 'publish', 'reason' => 'Reviewed', 'review_token' => $review['token']])->assertRedirect();

    $space = ParkingMunicipal::firstOrFail();
    expect($space)->external_id->toBe('000123')->number->toBeNull()->municipality_id->toBe($source->municipality_id)->visibility->toBeTrue();
    expect($space->source_record)->toEqual($data['records'][0]);
    expect($space->latitude)->toBeGreaterThan(52.3)->toBeLessThan(52.31);
    expect($space->longitude)->toBeGreaterThan(4.9)->toBeLessThan(4.91);
    expect($import->fresh())->state->toBe('published')->reviewed_by->toBe($user->id);
});

it('records a decision with an optional note', function (string $decision, string $state, array $note, ?string $expectedNote) {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $import = stageMunicipal(municipalDelivery(), $user);
    $review = app(MunicipalImportService::class)->review($import);

    $this->actingAs($user)->patch(route('app.municipal-imports.update', $import), [
        'decision' => $decision, 'review_token' => $review['token'], ...$note,
    ])->assertSessionHasNoErrors()->assertRedirect();

    expect($import->fresh())->state->toBe($state)->review_reason->toBe($expectedNote)
        ->reviewed_by->toBe($user->id)->reviewed_at->not->toBeNull();
    $this->assertDatabaseCount('parking_municipal_spaces', $decision === 'publish' ? 1 : 0);
})->with([
    'publish' => ['publish', 'published'],
    'reject' => ['reject', 'rejected'],
])->with([
    'omitted' => [[], null],
    'empty' => [['reason' => ''], null],
    'provided' => [['reason' => 'Brongegevens gecontroleerd.'], 'Brongegevens gecontroleerd.'],
]);

it('requires administrator authorization for every intake and review action', function (UserRole $role) {
    $source = DatasetSource::factory()->create();
    $import = MunicipalImport::factory()->for($source)->create();
    $user = User::factory()->create();
    $user->assignRole($role);
    expect(Gate::forUser($user)->allows('create', MunicipalImport::class))->toBeFalse();
    expect(Gate::forUser($user)->allows('update', $import))->toBeFalse();
    $this->actingAs($user)->get(route('app.municipal-imports.index'))->assertForbidden();
    $this->get(route('app.municipal-imports.show', $import))->assertForbidden();
    $this->post(route('app.municipal-imports.store'))->assertForbidden();
    $this->patch(route('app.municipal-imports.update', $import))->assertForbidden();
})->with([UserRole::USER, UserRole::MODERATOR]);

it('redirects guests and reports invalid files without staging records', function () {
    $this->get(route('app.municipal-imports.index'))->assertRedirect(route('login'));
    $this->actingAs(importReviewer())->post(route('app.municipal-imports.store'), ['file' => UploadedFile::fake()->createWithContent('bad.json', '{invalid')])->assertSessionHasErrors('file');
    $this->assertDatabaseCount('municipal_imports', 0);
});

it('rejects invalid source files without publishing', function (Closure $mutate) {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $data = municipalDelivery();
    $mutate($data);
    expect(fn () => stageMunicipal($data, $user))->toThrow(ValidationException::class);
    $this->assertDatabaseCount('municipal_imports', 0);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
})->with([
    'incomplete' => fn (&$d) => $d['complete'] = false,
    'empty' => function (&$d) {
        $d['records'] = [];
        $d['source_count'] = 0;
    },
    'wrong count' => fn (&$d) => $d['source_count'] = 2,
    'unknown dataset' => fn (&$d) => $d['dataset'] = 'other',
    'changed selection' => fn (&$d) => $d['selection'] = 'personal',
    'fraction' => fn (&$d) => $d['records'][0]['number'] = 1.5,
    'negative' => fn (&$d) => $d['records'][0]['number'] = -1,
    'numeric string' => fn (&$d) => $d['records'][0]['number'] = '1',
    'duplicate' => function (&$d) {
        $d['records'][] = $d['records'][0];
        $d['source_count'] = 2;
    },
    'personal' => fn (&$d) => $d['records'][0]['source_attributes']['regimes'][0]['kenteken'] = 'AA-01-BB',
    'unclosed geometry' => fn (&$d) => $d['records'][0]['geometry']['coordinates'][0][4] = [4.8, 52.3],
    'outside area' => fn (&$d) => $d['records'][0]['geometry']['coordinates'][0] = [[10, 52], [11, 52], [11, 53], [10, 52]],
    'collapsed polygon' => fn (&$d) => $d['records'][0]['geometry']['coordinates'][0] = [[4.9, 52.3], [4.91, 52.3], [4.92, 52.3], [4.9, 52.3]],
    'polygon with collapsed spike' => fn (&$d) => $d['records'][0]['geometry']['coordinates'][0] = [[4.9, 52.3], [4.91, 52.3], [4.92, 52.3], [4.91, 52.3], [4.91, 52.31], [4.9, 52.31], [4.9, 52.3]],
    'future' => fn (&$d) => $d['retrieved_at'] = now()->addDay()->format('Y-m-d\TH:i:s\Z'),
]);

it('rejects duplicate JSON keys including escaped equivalents', function () {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $json = json_encode(municipalDelivery());
    $json = str_replace('"number":null', '"number":0,"numb\\u0065r":null', $json);
    expect(fn () => app(MunicipalImportService::class)->intake($json, $user))->toThrow(ValidationException::class);
    $this->assertDatabaseCount('municipal_imports', 0);
});

it('reuses identical deliveries but refuses conflicting bytes', function () {
    $source = DatasetSource::factory()->create();
    $user = importReviewer();
    $data = municipalDelivery();
    $first = stageMunicipal($data, $user);
    $source->update(['bounds' => [0, 0, 1, 1]]);
    expect(stageMunicipal($data, $user)->id)->toBe($first->id);
    $data['records'][0]['number'] = 0;
    expect(fn () => stageMunicipal($data, $user))->toThrow(ValidationException::class);
    $this->assertDatabaseCount('municipal_imports', 1);
});

it('reports every unusable polygon without staging a partial delivery', function () {
    DatasetSource::factory()->create();
    $data = municipalDelivery();
    $data['records'][0]['geometry']['coordinates'][0] = [[4.9, 52.3], [4.91, 52.3], [4.92, 52.3], [4.9, 52.3]];
    $data['records'][] = [...$data['records'][0], 'external_id' => '000456'];
    $data['source_count'] = 2;
    $this->actingAs(importReviewer())->post(route('app.municipal-imports.store'), [
        'file' => UploadedFile::fake()->createWithContent('delivery.json', json_encode($data)),
    ])->assertSessionHasErrors(['geometry.000123', 'geometry.000456']);
    $this->assertDatabaseCount('municipal_imports', 0);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
});

it('preserves identities favorites manual visibility and unchanged timestamps', function () {
    $this->freezeTime();
    DatasetSource::factory()->create();
    $user = importReviewer();
    $data = municipalDelivery();
    approveMunicipal(stageMunicipal($data, $user), $user);
    $space = ParkingMunicipal::firstOrFail();
    $space->update(['visibility' => false]);
    $favorite = Favorite::factory()->for($user)->create(['favoritable_type' => ParkingMunicipal::class, 'favoritable_id' => $space->id]);
    $updated = $space->fresh()->updated_at;
    $this->travel(2)->minutes();
    $data['delivery_id'] = (string) Str::uuid();
    $data['retrieved_at'] = now()->subMinute()->format('Y-m-d\TH:i:s\Z');
    $second = stageMunicipal($data, $user);
    expect(app(MunicipalImportService::class)->review($second)['counts']['unchanged'])->toBe(1);
    approveMunicipal($second, $user);
    expect($space->fresh())->visibility->toBeFalse()->updated_at->toEqual($updated)->last_checked_at->toEqual(now()->startOfSecond());
    expect($space->fresh()->published_import_id)->toBe($second->id);
    $this->assertModelExists($favorite);
    $this->assertDatabaseCount('parking_municipal_spaces', 1);
});

it('records source changes and prior values without removing missing records', function () {
    $this->freezeTime();
    DatasetSource::factory()->create();
    $user = importReviewer();
    $data = municipalDelivery();
    $data['records'][] = [...$data['records'][0], 'external_id' => 'other'];
    $data['source_count'] = 2;
    approveMunicipal(stageMunicipal($data, $user), $user);
    $space = ParkingMunicipal::where('external_id', '000123')->firstOrFail();
    $this->travel(2)->minutes();
    $next = municipalDelivery();
    $next['records'][0]['number'] = 0;
    $next['records'][0]['source_attributes']['version_date'] = '2026-09-02';
    $import = stageMunicipal($next, $user);
    $review = app(MunicipalImportService::class)->review($import);
    expect($review['counts'])->changed->toBe(1)->missing->toBe(1);
    approveMunicipal($import, $user);
    expect($space->fresh()->number)->toBe(0);
    expect($import->fresh()->before_values[$space->id]['number'])->toBeNull();
    expect(ParkingMunicipal::where('external_id', 'other')->firstOrFail()->visibility)->toBeTrue();
    expect($space->fresh()->published_import_id)->toBe($import->id);
    expect(ParkingMunicipal::where('external_id', 'other')->firstOrFail()->published_import_id)->not->toBe($import->id);
});

it('blocks source conflicts with manual values and preserves nonconflicting corrections', function () {
    $this->freezeTime();
    DatasetSource::factory()->create();
    $user = importReviewer();
    approveMunicipal(stageMunicipal(municipalDelivery(), $user), $user);
    $space = ParkingMunicipal::firstOrFail();
    $space->update(['number' => 0]);
    $this->travel(2)->minutes();
    $data = municipalDelivery();
    $data['records'][0]['street'] = 'New street';
    approveMunicipal(stageMunicipal($data, $user), $user);
    expect($space->fresh())->number->toBe(0)->street->toBe('New street');
    $this->travel(2)->minutes();
    $data = municipalDelivery();
    $data['records'][0]['number'] = 2;
    $import = stageMunicipal($data, $user);
    expect(app(MunicipalImportService::class)->review($import)['counts']['conflict'])->toBe(1);
    expect(fn () => approveMunicipal($import, $user))->toThrow(ValidationException::class);
    expect($space->fresh()->number)->toBe(0);
    expect($import->fresh()->state)->toBe('pending');
});

it('blocks publication when the previous import values disappear after review', function () {
    $this->freezeTime();
    $source = DatasetSource::factory()->create();
    $user = importReviewer();
    approveMunicipal(stageMunicipal(municipalDelivery(), $user), $user);
    $space = ParkingMunicipal::firstOrFail();
    $publishedAt = $source->fresh()->last_published_retrieved_at;
    $this->travel(2)->minutes();
    $data = municipalDelivery();
    $data['records'][0]['number'] = 2;
    $import = stageMunicipal($data, $user);
    $service = app(MunicipalImportService::class);
    $token = $service->review($import)['token'];
    $space->forceFill(['last_imported_values' => null])->save();

    expect(fn () => $service->decide($import, $user, 'publish', 'Reviewed', $token))->toThrow(ValidationException::class);

    expect($service->review($import)['counts']['conflict'])->toBe(1);
    expect($space->fresh())->number->toBeNull()->last_imported_values->toBeNull();
    expect($import->fresh())->state->toBe('pending')->reviewed_at->toBeNull();
    expect($source->fresh()->last_published_retrieved_at->equalTo($publishedAt))->toBeTrue();
});

it('requires an explicit unknown source update date for the Amsterdam pilot', function (mixed $value) {
    DatasetSource::factory()->create();
    $data = municipalDelivery();
    $data['records'][0]['source_updated_at'] = $value;
    $file = UploadedFile::fake()->createWithContent('delivery.json', json_encode($data));

    $this->actingAs(importReviewer())->post(route('app.municipal-imports.store'), ['file' => $file])
        ->assertSessionHasErrors('records.0.source_updated_at');

    $this->assertDatabaseCount('municipal_imports', 0);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
})->with([
    'date with unverified meaning' => ['2026-01-01T00:00:00Z'],
    'empty string' => [''],
    'empty array' => [[]],
    'boolean' => [false],
]);

it('rechecks ordering and review state immediately before publication', function () {
    $this->freezeTime();
    DatasetSource::factory()->create();
    $user = importReviewer();
    $old = stageMunicipal(municipalDelivery(['retrieved_at' => now()->subMinutes(2)->format('Y-m-d\TH:i:s\Z')]), $user);
    $new = stageMunicipal(municipalDelivery(), $user);
    approveMunicipal($new, $user);
    expect(fn () => approveMunicipal($old, $user))->toThrow(ValidationException::class);
    expect(fn () => approveMunicipal($new, $user))->toThrow(ValidationException::class);
    $this->assertDatabaseCount('parking_municipal_spaces', 1);
});

it('rejects a stale review after a manual edit and can reject without changing parking', function () {
    $this->freezeTime();
    DatasetSource::factory()->create();
    $user = importReviewer();
    approveMunicipal(stageMunicipal(municipalDelivery(), $user), $user);
    $this->travel(2)->minutes();
    $import = stageMunicipal(municipalDelivery(), $user);
    $service = app(MunicipalImportService::class);
    $token = $service->review($import)['token'];
    ParkingMunicipal::firstOrFail()->update(['street' => 'Manual street']);
    expect(fn () => $service->decide($import, $user, 'publish', 'Reviewed', $token))->toThrow(ValidationException::class);
    $service->decide($import, $user, 'reject', 'Conflicting information', $token);
    expect($import->fresh()->state)->toBe('rejected');
    expect(ParkingMunicipal::firstOrFail()->street)->toBe('Manual street');
});

it('rolls back all records and import state on a database failure and permits retry', function () {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $import = stageMunicipal(municipalDelivery(), $user);
    DB::statement('ALTER TABLE parking_municipal_spaces ADD CONSTRAINT test_reject_import CHECK (external_id IS NULL)');
    expect(fn () => approveMunicipal($import, $user))->toThrow(QueryException::class);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
    expect($import->fresh()->state)->toBe('pending');
    DB::statement('ALTER TABLE parking_municipal_spaces DROP CONSTRAINT test_reject_import');
    approveMunicipal($import, $user);
    expect($import->fresh()->state)->toBe('published');
});

it('publishes an existing delivery after the legacy publication switch changes', function (bool $enabled) {
    $source = DatasetSource::factory()->create(['publication_enabled' => false]);
    $user = importReviewer();
    $service = app(MunicipalImportService::class);
    $import = stageMunicipal(municipalDelivery(), $user);
    $import->update(['dataset_config' => [...$import->dataset_config, 'publication_enabled' => false]]);
    $source->update(['publication_enabled' => $enabled]);

    $review = $service->review($import->fresh());

    expect($review['blockers'])->toBeEmpty();
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
    $this->actingAs($user)->patch(route('app.municipal-imports.update', $import), [
        'decision' => 'publish', 'reason' => 'Brongegevens gecontroleerd.', 'review_token' => $review['token'],
    ])->assertSessionHasNoErrors()->assertRedirect();
    expect($import->fresh()->state)->toBe('published');
    $this->assertDatabaseCount('parking_municipal_spaces', 1);
})->with([false, true]);

it('still blocks publication when the source geography changes', function () {
    $source = DatasetSource::factory()->create();
    $user = importReviewer();
    $import = stageMunicipal(municipalDelivery(), $user);
    $source->update(['bounds' => [4.8, 52.2, 5.15, 52.5]]);

    expect(app(MunicipalImportService::class)->review($import)['blockers'])
        ->toContain('De datasetconfiguratie is gewijzigd sinds ontvangst. Lever een nieuw bestand aan.');
    expect(fn () => approveMunicipal($import, $user))->toThrow(ValidationException::class);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
});

it('registers only the selected Amsterdam geography for manual review', function () {
    $source = DatasetSource::factory()->make();
    $municipality = $source->municipality;
    $this->artisan('nipkaart:register-dataset', ['dataset' => 'nl-amsterdam', 'municipality' => $municipality->id])->assertSuccessful();
    $this->artisan('nipkaart:register-dataset', ['dataset' => 'nl-amsterdam', 'municipality' => $municipality->id])->assertSuccessful();
    $this->assertDatabaseCount('dataset_sources', 1);
    expect(DatasetSource::firstOrFail()->publication_enabled)->toBeFalse();
    $municipality->update(['name' => 'Other municipality']);
    $this->artisan('nipkaart:register-dataset', ['dataset' => 'nl-amsterdam', 'municipality' => $municipality->id])->assertFailed();
});

it('refuses equally dated deliveries and retains subsecond ordering', function () {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $at = now()->subMinute()->format('Y-m-d\TH:i:s');
    $first = stageMunicipal(municipalDelivery(['retrieved_at' => $at.'.100000Z']), $user);
    approveMunicipal($first, $user);
    $equal = stageMunicipal(municipalDelivery(['retrieved_at' => $at.'.100000Z']), $user);
    expect(fn () => approveMunicipal($equal, $user))->toThrow(ValidationException::class);
    $later = stageMunicipal(municipalDelivery(['retrieved_at' => $at.'.200000Z']), $user);
    approveMunicipal($later, $user);
    expect($later->fresh()->state)->toBe('published');
});

it('keeps the original geometry and requires explicit review before publishing its derivation', function () {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $data = municipalDelivery();
    $data['records'][0]['geometry']['coordinates'][0] = [[4.9, 52.3], [4.91, 52.31], [4.91, 52.3], [4.9, 52.31], [4.9, 52.3]];
    $import = stageMunicipal($data, $user);
    $review = app(MunicipalImportService::class)->review($import);
    $decision = ['decision' => 'publish', 'reason' => 'Both polygon parts reviewed.', 'review_token' => $review['token']];

    expect($import->state)->toBe('pending');

    $this->actingAs($user)->get(route('app.municipal-imports.show', $import))->assertInertia(fn (Assert $page) => $page
        ->where('municipalityName', 'Amsterdam')
        ->where('review.derivations', 1)
        ->where('review.rows.0.after.geometry', $data['records'][0]['geometry'])
        ->where('review.rows.0.geometry_derivation.geometry.type', 'MultiPolygon'));
    $this->patch(route('app.municipal-imports.update', $import), $decision)->assertSessionHasErrors('geometry_reviewed');
    expect($import->fresh()->state)->toBe('pending');
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
    $this->patch(route('app.municipal-imports.update', $import), [...$decision, 'geometry_reviewed' => '1'])->assertSessionHasNoErrors();

    $space = ParkingMunicipal::firstOrFail();
    expect($space->source_record)->toEqual($data['records'][0]);
    expect($space->geometry_derivation)->toMatchArray(['method' => 'st_makevalid_linework']);
    expect($space->geometry_derivation['geometry']['coordinates'])->toHaveCount(2);
    expect($space->geometry_derivation['reason'])->toContain('Self-intersection');
    $geometry = DB::selectOne('SELECT ST_IsValid(ST_GeomFromGeoJSON(?)) AS valid, ST_Covers(ST_GeomFromGeoJSON(?), ST_SetSRID(ST_MakePoint(?, ?), 4326)) AS contains_point', [json_encode($space->geometry_derivation['geometry']), json_encode($space->geometry_derivation['geometry']), $space->longitude, $space->latitude]);
    expect($geometry)->valid->toBeTrue()->contains_point->toBeTrue();
    expect($import->fresh())->state->toBe('published')->reviewed_by->toBe($user->id);
    $this->get('/map')->assertInertia(fn (Assert $page) => $page
        ->component('frontend/map/index')
        ->has('municipalSpaces', 1)
        ->where('municipalSpaces.0.id', $space->id)
        ->where('municipalSpaces.0.latitude', $space->latitude)
        ->where('municipalSpaces.0.longitude', $space->longitude)
        ->missing('municipalSpaces.0.geometry')
        ->missing('municipalSpaces.0.geometry_derivation')
        ->missing('municipalSpaces.0.source_record'));
});

it('retains reviewed derivations on repeat and clears them when the source becomes valid', function () {
    $this->freezeTime();
    DatasetSource::factory()->create();
    $user = importReviewer();
    $data = municipalDelivery();
    $validGeometry = $data['records'][0]['geometry'];
    $data['records'][0]['geometry']['coordinates'][0] = [[4.9, 52.3], [4.91, 52.31], [4.91, 52.3], [4.9, 52.31], [4.9, 52.3]];
    $service = app(MunicipalImportService::class);
    $first = stageMunicipal($data, $user);
    $service->decide($first, $user, 'publish', 'Reviewed geometry.', $service->review($first)['token'], true);
    $space = ParkingMunicipal::firstOrFail();
    $originalDerivation = $space->geometry_derivation;
    $originalUpdated = $space->updated_at;
    $space->update(['visibility' => false]);
    $this->travel(2)->minutes();
    $data['delivery_id'] = (string) Str::uuid();
    $data['retrieved_at'] = now()->subMinute()->utc()->format('Y-m-d\TH:i:s.u\Z');
    $repeat = stageMunicipal($data, $user);

    expect($service->review($repeat)['counts']['unchanged'])->toBe(1);
    expect($service->review($repeat)['derivations'])->toBe(0);
    $this->actingAs($user)->get(route('app.municipal-imports.show', [$repeat, 'filter' => 'geometry']))->assertInertia(fn (Assert $page) => $page->has('review.rows', 0));
    $service->decide($repeat, $user, 'publish', null, $service->review($repeat)['token']);
    expect($space->fresh())->geometry_derivation->toEqual($originalDerivation)->updated_at->toEqual($originalUpdated)->visibility->toBeFalse();
    $this->travel(2)->minutes();
    $data['delivery_id'] = (string) Str::uuid();
    $data['retrieved_at'] = now()->subMinute()->utc()->format('Y-m-d\TH:i:s.u\Z');
    $data['records'][0]['geometry'] = $validGeometry;
    $corrected = stageMunicipal($data, $user);
    expect($service->review($corrected)['derivations'])->toBe(0);
    approveMunicipal($corrected, $user);

    expect($space->fresh())->source_record->toEqual($data['records'][0])->geometry_derivation->toBeNull()->visibility->toBeFalse();
    expect(json_decode($corrected->fresh()->before_values[$space->id]['geometry_derivation'], true))->toEqual($originalDerivation);
    $this->assertDatabaseCount('parking_municipal_spaces', 1);
});

it('can reject a delivery with derived geometries without approving those geometries', function () {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $data = municipalDelivery();
    $data['records'][0]['geometry']['coordinates'][0] = [[4.9, 52.3], [4.91, 52.31], [4.91, 52.3], [4.9, 52.31], [4.9, 52.3]];
    $import = stageMunicipal($data, $user);

    $this->actingAs($user)->patch(route('app.municipal-imports.update', $import), [
        'decision' => 'reject', 'reason' => 'The proposed shape does not match the parking area.',
        'review_token' => app(MunicipalImportService::class)->review($import)['token'],
    ])->assertSessionHasNoErrors();
    expect($import->fresh()->state)->toBe('rejected');
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
});

it('searches and filters the whole delivery without narrowing its publication review', function () {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $data = municipalDelivery();
    $record = $data['records'][0];
    $data['records'] = [];
    for ($index = 0; $index < 26; $index++) {
        $data['records'][] = [...$record, 'external_id' => sprintf('record-%02d', $index), 'street' => $index === 25 ? 'Unieke straat' : 'Teststraat'];
    }
    $data['source_count'] = 26;
    $import = stageMunicipal($data, $user);
    $token = app(MunicipalImportService::class)->review($import)['token'];

    $this->actingAs($user)->get(route('app.municipal-imports.show', $import))->assertInertia(fn (Assert $page) => $page
        ->has('review.rows', 25)->where('total', 26)->where('pages', 2));
    $this->get(route('app.municipal-imports.show', [$import, 'q' => 'UNIEKE', 'filter' => 'new', 'page' => 2]))->assertInertia(fn (Assert $page) => $page
        ->has('review.rows', 1)->where('review.rows.0.external_id', 'record-25')
        ->where('total', 1)->where('page', 1)->where('pages', 1)
        ->where('review.counts.new', 26)->where('review.token', $token));
    $this->get(route('app.municipal-imports.show', [$import, 'q' => 'record-25']))->assertInertia(fn (Assert $page) => $page
        ->has('review.rows', 1)->where('review.rows.0.external_id', 'record-25'));
    $this->get(route('app.municipal-imports.show', [$import, 'filter' => 'changed']))->assertInertia(fn (Assert $page) => $page
        ->has('review.rows', 0)->where('total', 0)->where('pages', 1)->where('review.counts.new', 26));
});

it('filters derived geometries without changing the required review count', function () {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $data = municipalDelivery();
    $data['records'][] = [...$data['records'][0], 'external_id' => 'derived'];
    $data['records'][1]['geometry']['coordinates'][0] = [[4.9, 52.3], [4.91, 52.31], [4.91, 52.3], [4.9, 52.31], [4.9, 52.3]];
    $data['source_count'] = 2;
    $import = stageMunicipal($data, $user);

    $this->actingAs($user)->get(route('app.municipal-imports.show', [$import, 'filter' => 'geometry']))->assertInertia(fn (Assert $page) => $page
        ->has('review.rows', 1)->where('review.rows.0.external_id', 'derived')->where('review.derivations', 1)->where('review.counts.new', 2));
});

it('filters the delivery overview by source name and review status', function () {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $published = stageMunicipal(municipalDelivery(), $user);
    approveMunicipal($published, $user);
    $this->travel(2)->minutes();
    $pending = stageMunicipal(municipalDelivery(), $user);

    $this->actingAs($user)->get(route('app.municipal-imports.index', ['q' => 'AMSTERDAM', 'state' => 'pending']))->assertInertia(fn (Assert $page) => $page
        ->has('imports.data', 1)->where('imports.data.0.id', $pending->id)->where('imports.total', 1)
        ->where('filters.q', 'AMSTERDAM')->where('filters.state', 'pending'));
    $this->get(route('app.municipal-imports.index', ['q' => 'No matching source']))->assertInertia(fn (Assert $page) => $page
        ->has('imports.data', 0)->where('imports.total', 0));
});

it('requires renewed geometry review when the source geometry changes', function () {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $data = municipalDelivery();
    $data['records'][0]['geometry']['coordinates'][0] = [[4.9, 52.3], [4.91, 52.31], [4.91, 52.3], [4.9, 52.31], [4.9, 52.3]];
    $service = app(MunicipalImportService::class);
    $first = stageMunicipal($data, $user);
    $service->decide($first, $user, 'publish', null, $service->review($first)['token'], true);
    $this->travel(2)->minutes();
    $data['delivery_id'] = (string) Str::uuid();
    $data['retrieved_at'] = now()->subMinute()->utc()->format('Y-m-d\TH:i:s.u\Z');
    $data['records'][0]['geometry']['coordinates'][0][1][0] = 4.92;
    $changed = stageMunicipal($data, $user);
    $review = $service->review($changed);

    expect($review['derivations'])->toBe(1);
    $this->actingAs($user)->patch(route('app.municipal-imports.update', $changed), [
        'decision' => 'publish', 'review_token' => $review['token'],
    ])->assertSessionHasErrors('geometry_reviewed');
    expect($changed->fresh()->state)->toBe('pending');
    expect(ParkingMunicipal::firstOrFail()->source_record)->toEqual($first->records[0]['source']);
});

it('shows changes by default while keeping unchanged records available', function () {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $data = municipalDelivery();
    approveMunicipal(stageMunicipal($data, $user), $user);
    $this->travel(2)->minutes();
    $data['delivery_id'] = (string) Str::uuid();
    $data['retrieved_at'] = now()->subMinute()->utc()->format('Y-m-d\TH:i:s.u\Z');
    $repeat = stageMunicipal($data, $user);

    $this->actingAs($user)->get(route('app.municipal-imports.show', $repeat))->assertInertia(fn (Assert $page) => $page
        ->where('filters.filter', 'changes')->has('review.rows', 0)->where('review.counts.unchanged', 1));
    $this->get(route('app.municipal-imports.show', [$repeat, 'filter' => 'all']))->assertInertia(fn (Assert $page) => $page
        ->has('review.rows', 1)->where('review.rows.0.status', 'unchanged'));
});

it('summarizes each municipal source and scopes its delivery history', function () {
    $source = DatasetSource::factory()->create();
    $user = importReviewer();
    $published = stageMunicipal(municipalDelivery(), $user);
    approveMunicipal($published, $user);
    $this->travel(2)->minutes();
    $latest = stageMunicipal(municipalDelivery(), $user);
    $old = MunicipalImport::factory()->for($source)->create(['retrieved_at' => now()->subDays(3)]);
    MunicipalDelivery::factory()->create(['dataset_source_id' => $source->id, 'state' => 'rejected', 'error_code' => 'invalid_delivery']);
    config(['municipal-deliveries.sources.other-source.max_age_hours' => 48]);
    $other = DatasetSource::factory()->for($source->municipality)->create(['code' => 'other-source', 'name' => 'ZZ Other']);
    MunicipalImport::factory()->for($other)->create(['retrieved_at' => now()->subDays(3)]);

    $this->actingAs($user)->get(route('app.municipal-imports.index'))->assertInertia(fn (Assert $page) => $page
        ->where('filters.tab', 'sources')->has('datasets', 2)
        ->where('datasets.0.latest_import.id', $latest->id)->where('datasets.0.needs_review', true)
        ->where('datasets.0.visible_locations_count', 1)->where('datasets.0.stale', false)
        ->where('datasets.0.latest_delivery.error_code', 'invalid_delivery')
        ->where('datasets.1.stale', true));
    $this->get(route('app.municipal-imports.index', ['tab' => 'deliveries', 'dataset' => $source->id]))->assertInertia(fn (Assert $page) => $page
        ->where('filters.dataset', $source->id)->where('filters.tab', 'deliveries')
        ->has('imports.data', 3)->where('imports.data.0.id', $old->id));
    approveMunicipal($latest, $user);
    $this->get(route('app.municipal-imports.index'))->assertInertia(fn (Assert $page) => $page->where('datasets.0.needs_review', false));
});

it('marks superseded pending deliveries as history without changing their stored decision', function () {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $older = stageMunicipal(municipalDelivery(), $user);
    $this->travel(2)->minutes();
    $published = stageMunicipal(municipalDelivery(), $user);
    approveMunicipal($published, $user);

    $this->actingAs($user)->get(route('app.municipal-imports.index', ['state' => 'pending']))->assertInertia(fn (Assert $page) => $page->has('imports.data', 0));
    $this->get(route('app.municipal-imports.index', ['state' => 'superseded']))->assertInertia(fn (Assert $page) => $page
        ->has('imports.data', 1)->where('imports.data.0.id', $older->id)->where('imports.data.0.superseded', true));
    $this->get(route('app.municipal-imports.show', $older))->assertInertia(fn (Assert $page) => $page->where('import.superseded', true));
    $this->get(route('app.municipal-imports.show', $published))->assertInertia(fn (Assert $page) => $page->where('import.superseded', false));
    expect($older->fresh()->state)->toBe('pending');
});

it('keeps version-only updates out of changes while preserving dates and missing records', function () {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $data = municipalDelivery();
    $data['records'][] = array_replace($data['records'][0], ['external_id' => 'missing']);
    $data['source_count'] = 2;
    approveMunicipal(stageMunicipal($data, $user), $user);
    $data['delivery_id'] = (string) Str::uuid();
    $data['retrieved_at'] = now()->utc()->format('Y-m-d\TH:i:s.u\Z');
    array_pop($data['records']);
    $data['source_count'] = 1;
    $data['records'][0]['source_attributes']['version_date'] = '2026-09-24';
    $import = stageMunicipal($data, $user);

    $this->actingAs($user)->get(route('app.municipal-imports.show', $import))->assertInertia(fn (Assert $page) => $page
        ->where('review.counts.changed', 0)->where('review.counts.unchanged', 1)->where('review.counts.missing', 1)
        ->has('review.rows', 1)->where('review.rows.0.external_id', 'missing')
        ->where('review.rows.0.point.latitude', (float) ParkingMunicipal::where('external_id', 'missing')->sole()->latitude)
        ->where('review.rows.0.point.longitude', (float) ParkingMunicipal::where('external_id', 'missing')->sole()->longitude));

    approveMunicipal($import, $user);
    expect(ParkingMunicipal::where('external_id', '000123')->sole()->source_record['source_attributes']['version_date'])->toBe('2026-09-24');
    expect(ParkingMunicipal::where('external_id', 'missing')->sole()->visibility)->toBeTrue();
});

it('still detects changed parking rules alongside a new version date', function () {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $data = municipalDelivery();
    approveMunicipal(stageMunicipal($data, $user), $user);
    $data['delivery_id'] = (string) Str::uuid();
    $data['retrieved_at'] = now()->utc()->format('Y-m-d\TH:i:s.u\Z');
    $data['records'][0]['source_attributes']['version_date'] = '2026-09-24';
    $data['records'][0]['source_attributes']['regimes'][0]['beginTijd'] = '10:00:00';

    $review = app(MunicipalImportService::class)->review(stageMunicipal($data, $user));

    expect($review['counts']['changed'])->toBe(1);
    expect($review['rows'][0]['fields'])->toContain('source_attributes');
});

it('ignores reordered parking rules but still detects changed rules', function () {
    DatasetSource::factory()->create();
    $user = importReviewer();
    $data = municipalDelivery();
    $data['records'][0]['source_attributes']['regimes'][] = array_replace($data['records'][0]['source_attributes']['regimes'][0], ['beginTijd' => '14:00:00']);
    approveMunicipal(stageMunicipal($data, $user), $user);
    $data['delivery_id'] = (string) Str::uuid();
    $data['retrieved_at'] = now()->utc()->format('Y-m-d\TH:i:s.u\Z');
    $data['records'][0]['source_attributes']['regimes'] = array_reverse($data['records'][0]['source_attributes']['regimes']);
    $service = app(MunicipalImportService::class);

    expect($service->review(stageMunicipal($data, $user))['counts']['unchanged'])->toBe(1);

    $data['delivery_id'] = (string) Str::uuid();
    $data['records'][0]['source_attributes']['regimes'][0]['beginTijd'] = '15:00:00';
    expect($service->review(stageMunicipal($data, $user))['counts']['changed'])->toBe(1);
});
