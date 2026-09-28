<?php

use App\Enums\UserRole;
use App\Models\Country;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\Province;
use App\Models\User;
use App\Services\DatasetDeliveryStorage;
use App\Services\MunicipalImportService;
use Database\Factories\DatasetSourceFactory;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

/** Eindhoven publishes points without a stated licence; the collector delivers them as-is (ADR 0013). */
function eindhovenDescription(): array
{
    return DatasetSourceFactory::municipalDescription([
        'name' => 'Eindhoven gehandicaptenparkeerplaatsen', 'publisher' => 'Gemeente Eindhoven', 'licence' => null,
        'source_url' => 'https://data.eindhoven.nl/explore/dataset/parkeerplaatsen/',
        'terms_url' => 'https://data.eindhoven.nl/explore/dataset/parkeerplaatsen/information/',
        'attribution' => 'Gemeente Eindhoven; parkeerplaatsen, type Parkeerplaats Gehandicapten.',
        'area' => ['country' => 'NL', 'subdivision' => 'NL-NB', 'municipality' => ['scheme' => 'nl-cbs', 'code' => 'GM0772', 'name' => 'Eindhoven']],
        'bounds' => [5.32, 51.35, 5.62, 51.52],
    ]);
}

function eindhovenSource(): DatasetSource
{
    return DatasetSource::factory()->create([
        'code' => 'nl-eindhoven', 'selection' => 'gehandicapten-all',
        ...DatasetSource::attributesFromDescription(eindhovenDescription()),
        'municipality_id' => Municipality::factory()->state(['name' => 'Eindhoven', 'code_scheme' => 'nl-cbs', 'code' => 'GM0772'])
            ->for(Province::factory()->state(['geocode' => 'NL-NB'])->for(Country::factory()->state(['code' => 'NL']))),
    ]);
}

function eindhovenDelivery(): array
{
    return [
        'format' => 'nipkaart-municipal-2', 'dataset' => 'nl-eindhoven', 'source' => eindhovenDescription(),
        'delivery_id' => (string) Str::uuid(), 'retrieved_at' => now()->subMinute()->utc()->format('Y-m-d\TH:i:s.u\Z'),
        'selection' => 'gehandicapten-all', 'complete' => true, 'source_count' => 1,
        'records' => [[
            'external_id' => '15626', 'geometry' => ['type' => 'Point', 'coordinates' => [5.4816831, 51.4493127]],
            'number' => null, 'street' => 'Venbergsemolen', 'access_category' => 'unknown', 'orientation' => null,
            'source_attributes' => ['objectid' => 15626, 'type_en_merk' => 'Parkeerplaats Gehandicapten'],
            'source_updated_at' => null,
        ]],
    ];
}

it('stages Eindhoven points and publishes them after review of the approved source', function () {
    eindhovenSource();
    $user = User::factory()->create();
    $user->assignRole(UserRole::ADMIN);
    $data = eindhovenDelivery();
    $this->mock(DatasetDeliveryStorage::class)->shouldReceive('archive')->once()
        ->with(json_encode($data), 'municipal', 'nl-eindhoven', $data['delivery_id']);

    $this->actingAs($user)->post(route('app.imports.store'), [
        'file' => UploadedFile::fake()->createWithContent('eindhoven.json', json_encode($data)),
    ])->assertSessionHasNoErrors()->assertRedirect();

    $import = DatasetImport::firstOrFail();
    expect($import->records[0]['values'])->toEqual([
        'street' => 'Venbergsemolen', 'number' => null, 'orientation' => null,
        'longitude' => 5.4816831, 'latitude' => 51.4493127,
    ]);
    expect($import->records[0]['geometry_derivation'])->toBeNull();
    $this->get(route('app.imports.show', $import))->assertInertia(fn (Assert $page) => $page
        ->component('backend/imports/show')->has('review.blockers', 0)->where('review.counts.new', 1));
    $review = app(MunicipalImportService::class)->review($import);
    $this->patch(route('app.imports.update', $import), [
        'decision' => 'publish', 'review_token' => $review['token'],
    ])->assertSessionHasNoErrors();

    expect(ParkingMunicipal::sole())->external_id->toBe('15626')->orientation->toBeNull();
});

it('accepts the same Eindhoven storage delivery only once and allows rejection', function () {
    eindhovenSource();
    $data = eindhovenDelivery();
    $service = app(MunicipalImportService::class);
    $json = json_encode($data, JSON_THROW_ON_ERROR);
    $import = $service->intakeFromStorage($json, $data['dataset'], $data['delivery_id']);
    expect($service->intakeFromStorage($json, $data['dataset'], $data['delivery_id'])->id)->toBe($import->id);
    $this->assertDatabaseCount('dataset_imports', 1);
    $user = User::factory()->create();
    $user->assignRole(UserRole::ADMIN);

    $service->decide($import, $user, 'reject', 'Bron moet eerst worden bevestigd.', $service->review($import)['token']);

    expect($import->fresh()->state)->toBe('rejected');
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
});

it('rejects invalid point deliveries without staging or publishing', function (Closure $mutate) {
    eindhovenSource();
    $data = eindhovenDelivery();
    $mutate($data);

    expect(fn () => app(MunicipalImportService::class)->intakeFromStorage(
        json_encode($data, JSON_THROW_ON_ERROR), $data['dataset'], $data['delivery_id'],
    ))->toThrow(ValidationException::class);

    $this->assertDatabaseCount('dataset_imports', 0);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
})->with([
    'timestamp as source date' => fn (&$data) => $data['records'][0]['source_updated_at'] = '2026-09-15T13:42:49Z',
    'outside Eindhoven' => fn (&$data) => $data['records'][0]['geometry']['coordinates'] = [4.9, 52.3],
    'invalid latitude' => fn (&$data) => $data['records'][0]['geometry']['coordinates'] = [5.48, 91],
    'string coordinate' => fn (&$data) => $data['records'][0]['geometry']['coordinates'][0] = '5.48',
    'boolean coordinate' => fn (&$data) => $data['records'][0]['geometry']['coordinates'][0] = true,
    'extra dimension' => fn (&$data) => $data['records'][0]['geometry']['coordinates'][] = 0,
    'empty polygon' => fn (&$data) => $data['records'][0]['geometry'] = ['type' => 'Polygon', 'coordinates' => []],
    'selection mismatch' => fn (&$data) => $data['selection'] = 'e6a-all',
    'incomplete' => fn (&$data) => $data['complete'] = false,
    'fractional capacity' => fn (&$data) => $data['records'][0]['number'] = 1.5,
]);
