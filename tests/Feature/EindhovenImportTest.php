<?php

use App\Enums\UserRole;
use App\Models\Country;
use App\Models\DatasetSource;
use App\Models\MunicipalImport;
use App\Models\Municipality;
use App\Models\Province;
use App\Models\User;
use App\Services\MunicipalDeliveryStorage;
use App\Services\MunicipalImportService;
use App\Support\MunicipalSnapshot;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

function eindhovenSource(): DatasetSource
{
    return DatasetSource::factory()->create([
        'code' => MunicipalSnapshot::EINDHOVEN_DATASET,
        'selection' => 'gehandicapten-all',
        'bounds' => [5.32, 51.35, 5.62, 51.52],
        'municipality_id' => Municipality::factory()->state(['name' => 'Eindhoven'])
            ->for(Province::factory()->state(['geocode' => 'NL-NB'])->for(Country::factory()->state(['code' => 'NL']))),
    ]);
}

function eindhovenDelivery(): array
{
    return [
        'format' => 'nipkaart-municipal-pilot-1', 'dataset' => MunicipalSnapshot::EINDHOVEN_DATASET,
        'delivery_id' => (string) Str::uuid(), 'retrieved_at' => now()->subMinute()->utc()->format('Y-m-d\TH:i:s.u\Z'),
        'selection' => 'gehandicapten-all', 'complete' => true, 'source_count' => 1,
        'records' => [[
            'external_id' => '15626', 'geometry' => ['type' => 'Point', 'coordinates' => [5.4816831, 51.4493127]],
            'number' => null, 'street' => 'Venbergsemolen', 'access_category' => 'unknown',
            'source_attributes' => ['objectid' => 15626, 'type_en_merk' => 'Parkeerplaats Gehandicapten'],
            'source_updated_at' => null,
        ]],
    ];
}

it('archives Eindhoven points for review while refusing publication even by an administrator', function () {
    eindhovenSource();
    $user = User::factory()->create();
    $user->assignRole(UserRole::ADMIN);
    $data = eindhovenDelivery();
    $this->mock(MunicipalDeliveryStorage::class)->shouldReceive('archive')->once()
        ->with(json_encode($data), MunicipalSnapshot::EINDHOVEN_DATASET, $data['delivery_id']);

    $this->actingAs($user)->post(route('app.municipal-imports.store'), [
        'file' => UploadedFile::fake()->createWithContent('eindhoven.json', json_encode($data)),
    ])->assertSessionHasNoErrors()->assertRedirect();

    $import = MunicipalImport::firstOrFail();
    expect($import->records[0]['source'])->toEqual($data['records'][0]);
    expect($import->records[0]['values'])->toEqual([
        'street' => 'Venbergsemolen', 'number' => null, 'orientation' => null,
        'longitude' => 5.4816831, 'latitude' => 51.4493127,
    ]);
    expect($import->records[0]['geometry_derivation'])->toBeNull();
    $this->get(route('app.municipal-imports.show', $import))->assertInertia(fn (Assert $page) => $page
        ->component('backend/municipal-imports/show')->has('review.blockers', 1)->where('review.counts.new', 1));
    $review = app(MunicipalImportService::class)->review($import);
    $this->patch(route('app.municipal-imports.update', $import), [
        'decision' => 'publish', 'review_token' => $review['token'],
    ])->assertSessionHasErrors('decision');
    expect($import->fresh()->state)->toBe('pending');
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
});

it('accepts the same Eindhoven storage delivery only once and allows rejection', function () {
    eindhovenSource();
    $data = eindhovenDelivery();
    $service = app(MunicipalImportService::class);
    $json = json_encode($data, JSON_THROW_ON_ERROR);
    $import = $service->intakeFromStorage($json, $data['dataset'], $data['delivery_id']);
    expect($service->intakeFromStorage($json, $data['dataset'], $data['delivery_id'])->id)->toBe($import->id);
    $this->assertDatabaseCount('municipal_imports', 1);
    $user = User::factory()->create();
    $user->assignRole(UserRole::ADMIN);

    $service->decide($import, $user, 'reject', 'Bron moet eerst worden bevestigd.', $service->review($import)['token']);

    expect($import->fresh()->state)->toBe('rejected');
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
});

it('rejects invalid Eindhoven claims without staging or publishing', function (Closure $mutate) {
    eindhovenSource();
    $data = eindhovenDelivery();
    $mutate($data);

    expect(fn () => app(MunicipalImportService::class)->intakeFromStorage(
        json_encode($data, JSON_THROW_ON_ERROR), $data['dataset'], $data['delivery_id'],
    ))->toThrow(ValidationException::class);

    $this->assertDatabaseCount('municipal_imports', 0);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
})->with([
    'unverified general access' => fn (&$data) => $data['records'][0]['access_category'] = 'general',
    'other category' => fn (&$data) => $data['records'][0]['source_attributes']['type_en_merk'] = 'Parkeerplaats',
    'identity mismatch' => fn (&$data) => $data['records'][0]['external_id'] = '15627',
    'string objectid' => fn (&$data) => $data['records'][0]['source_attributes']['objectid'] = '15626',
    'invented source date' => fn (&$data) => $data['records'][0]['source_updated_at'] = '2026-09-15T13:42:49Z',
    'outside Eindhoven' => fn (&$data) => $data['records'][0]['geometry']['coordinates'] = [4.9, 52.3],
    'invalid latitude' => fn (&$data) => $data['records'][0]['geometry']['coordinates'] = [5.48, 91],
    'string coordinate' => fn (&$data) => $data['records'][0]['geometry']['coordinates'][0] = '5.48',
    'boolean coordinate' => fn (&$data) => $data['records'][0]['geometry']['coordinates'][0] = true,
    'extra dimension' => fn (&$data) => $data['records'][0]['geometry']['coordinates'][] = 0,
    'polygon' => fn (&$data) => $data['records'][0]['geometry'] = ['type' => 'Polygon', 'coordinates' => []],
    'selection mismatch' => fn (&$data) => $data['selection'] = 'e6a-all',
    'incomplete' => fn (&$data) => $data['complete'] = false,
    'fractional capacity' => fn (&$data) => $data['records'][0]['number'] = 1.5,
]);

it('registers Eindhoven idempotently without changing a reviewed source configuration', function () {
    $source = eindhovenSource();
    $municipality = $source->municipality;
    $source->delete();
    $this->artisan('nipkaart:register-dataset', ['dataset' => 'nl-eindhoven', 'municipality' => $municipality->id])->assertSuccessful();
    $source = DatasetSource::firstOrFail();
    expect($source->publication_enabled)->toBeFalse();
    expect($source->municipality_id)->toBe($municipality->id);
    $source->update(['attribution' => 'Reviewed source attribution']);

    $this->artisan('nipkaart:register-dataset', ['dataset' => 'nl-eindhoven', 'municipality' => $municipality->id])->assertSuccessful();

    $this->assertDatabaseCount('dataset_sources', 1);
    expect($source->fresh()->attribution)->toBe('Reviewed source attribution');
});

it('refuses registration for the wrong municipality or province', function (string $name, string $geocode) {
    $municipality = Municipality::factory()->state(['name' => $name])
        ->for(Province::factory()->state(['geocode' => $geocode])->for(Country::factory()->state(['code' => 'NL'])))->create();

    $this->artisan('nipkaart:register-dataset', ['dataset' => 'nl-eindhoven', 'municipality' => $municipality->id])->assertFailed();

    $this->assertDatabaseCount('dataset_sources', 0);
})->with([['Amsterdam', 'NL-NB'], ['Eindhoven', 'NL-NH']]);
