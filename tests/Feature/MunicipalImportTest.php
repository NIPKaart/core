<?php

use App\Enums\UserRole;
use App\Models\DatasetSource;
use App\Models\Favorite;
use App\Models\MunicipalImport;
use App\Models\ParkingMunicipal;
use App\Models\User;
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
        'format' => 'nipkaart-municipal-pilot-1', 'dataset' => 'nl-amsterdam-parkeervakken-e6a',
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
    $this->post(route('app.municipal-imports.datasets.enable', $source))->assertForbidden();
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

it('records source terms before staging and blocks publication when disabled or reconfigured', function () {
    $source = DatasetSource::factory()->create(['publication_enabled' => false]);
    $user = importReviewer();
    $service = app(MunicipalImportService::class);
    $blocked = stageMunicipal(municipalDelivery(), $user);
    expect($service->review($blocked)['blockers'])->not->toBeEmpty();
    expect(fn () => approveMunicipal($blocked, $user))->toThrow(ValidationException::class);
    $this->actingAs($user)->post(route('app.municipal-imports.datasets.enable', $source), ['terms_confirmed' => true, 'reason' => 'CC0 catalogue and current API terms reviewed'])->assertRedirect();
    expect($source->fresh()->terms_review['user_id'])->toBe($user->id);
    $import = stageMunicipal(municipalDelivery(), $user);
    $source->refresh()->update(['bounds' => [4.8, 52.2, 5.15, 52.5]]);
    expect(fn () => approveMunicipal($import, $user))->toThrow(ValidationException::class);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
});

it('registers only the selected Amsterdam geography without enabling publication', function () {
    $source = DatasetSource::factory()->make();
    $municipality = $source->municipality;
    $this->artisan('nipkaart:register-amsterdam', ['municipality' => $municipality->id])->assertSuccessful();
    $this->artisan('nipkaart:register-amsterdam', ['municipality' => $municipality->id])->assertSuccessful();
    $this->assertDatabaseCount('dataset_sources', 1);
    expect(DatasetSource::firstOrFail()->publication_enabled)->toBeFalse();
    $municipality->update(['name' => 'Other municipality']);
    $this->artisan('nipkaart:register-amsterdam', ['municipality' => $municipality->id])->assertFailed();
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
    $service->decide($repeat, $user, 'publish', 'Reviewed repeated geometry.', $service->review($repeat)['token'], true);
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
