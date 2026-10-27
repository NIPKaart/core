<?php

use App\Enums\UserRole;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\User;
use App\Notifications\DatasetImport\ReadyForReview;
use App\Services\DatasetDeliveryService;
use App\Services\DatasetDeliveryStorage;
use App\Services\DatasetImports;
use App\Services\DatasetPublicationPolicy;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

function automaticRecords(string $type, int $count): array
{
    return array_map(function (int $index) use ($type): array {
        $common = ['external_id' => 'record-'.$index, 'geometry' => ['type' => 'Point', 'coordinates' => [4.8 + ($index % 10) * 0.005, 52.3 + intdiv($index, 10) * 0.005]]];

        return $type === 'offstreet'
            ? [...$common, 'name' => 'Garage '.$index, 'source_name' => 'Garage '.$index, 'facility_type' => 'garage']
            : [...$common, 'street' => 'Straat '.$index, 'number' => null, 'orientation' => null, 'access_category' => 'general', 'source_attributes' => ['kind' => 'general'], 'source_updated_at' => null];
    }, range(1, $count));
}

function automaticDelivery(DatasetSource $source, array $records): array
{
    return [
        'format' => $source->target_type === 'offstreet' ? 'nipkaart-offstreet-catalog-3' : 'nipkaart-municipal-2',
        'dataset' => $source->code, 'selection' => $source->selection, 'source' => $source->description,
        'delivery_id' => (string) Str::uuid(), 'retrieved_at' => now()->subMinute()->utc()->format('Y-m-d\TH:i:s.u\Z'),
        'complete' => true, 'source_count' => count($records), 'records' => $records,
    ];
}

function receiveAutomatic(DatasetSource $source, array $records): DatasetImport
{
    $data = automaticDelivery($source, $records);

    return app(DatasetImports::class)->forSource($source)->intakeFromStorage(json_encode($data, JSON_THROW_ON_ERROR), $source->code, $data['delivery_id']);
}

function manuallyEstablishDataset(string $type, int $count = 25): array
{
    $source = ($type === 'offstreet' ? DatasetSource::factory()->offstreet() : DatasetSource::factory())->create();
    $admin = User::factory()->create();
    $admin->assignRole(UserRole::ADMIN);
    $records = automaticRecords($type, $count);
    $service = app(DatasetImports::class)->forSource($source);
    $first = $service->intake(json_encode(automaticDelivery($source, $records), JSON_THROW_ON_ERROR), $admin);
    $service->decide($first, $admin, 'publish', 'First delivery checked.', $service->review($first)['token']);

    return [$source->fresh(), $admin, $records, $first->fresh()];
}

it('keeps first deliveries pending and publishes only subsequent safe updates without notifications', function (string $type) {
    $this->freezeTime();
    $source = ($type === 'offstreet' ? DatasetSource::factory()->offstreet() : DatasetSource::factory())->create();
    $admin = User::factory()->create();
    $admin->assignRole(UserRole::ADMIN);
    Notification::fake();
    $records = automaticRecords($type, 25);
    $first = receiveAutomatic($source, $records);

    expect($first)->state->toBe('pending')->publication_method->toBeNull();
    expect($first->publication_checks['reasons'])->toContain('first_publication');
    Notification::assertSentToTimes($admin, ReadyForReview::class, 1);
    $service = app(DatasetImports::class)->forSource($source);
    $service->decide($first, $admin, 'publish', null, $service->review($first)['token']);
    $this->travel(1)->days();
    Notification::fake();
    $second = receiveAutomatic($source->fresh(), $records);
    $this->travel(1)->days();
    $records[] = automaticRecords($type, 26)[25];
    $third = receiveAutomatic($source->fresh(), $records);

    expect($first->fresh()->publication_method)->toBe('manual');
    expect($second)->state->toBe('published')->publication_method->toBe('automatic')->reviewed_by->toBeNull()->reviewed_at->not->toBeNull();
    expect($second->publication_checks['reasons'])->toBeEmpty();
    expect($third)->state->toBe('published')->publication_method->toBe('automatic');
    expect($source->fresh()->last_published_retrieved_at->equalTo($third->retrieved_at))->toBeTrue();
    $this->assertDatabaseCount($type === 'offstreet' ? 'parking_offstreet_spaces' : 'parking_municipal_spaces', 26);
    Notification::assertNothingSent();
    $this->actingAs($admin)->get(route('app.imports.show', $third))->assertInertia(fn ($page) => $page
        ->where('import.publication_method', 'automatic')->where('import.publication_checks.reasons', []));
})->with(['municipal', 'offstreet']);

it('holds growth and disappearance anomalies while retaining the previous published records', function (string $type, string $change) {
    $this->freezeTime();
    [$source, $admin, $records, $previous] = manuallyEstablishDataset($type);
    $this->travel(1)->days();
    Notification::fake();
    $next = $change === 'rapid_growth' ? automaticRecords($type, 35) : array_slice($records, 3);
    $import = receiveAutomatic($source, $next);

    expect($import)->state->toBe('pending')->publication_method->toBeNull();
    expect($import->publication_checks['reasons'])->toContain($change);
    expect($source->fresh()->last_published_retrieved_at->equalTo($previous->retrieved_at))->toBeTrue();
    $this->assertDatabaseCount($type === 'offstreet' ? 'parking_offstreet_spaces' : 'parking_municipal_spaces', 25);
    Notification::assertSentToTimes($admin, ReadyForReview::class, 1);
    $service = app(DatasetImports::class)->forSource($source);
    $service->decide($import, $admin, 'publish', 'Expected source expansion or removal.', $service->review($import)['token']);
    expect($import->fresh()->publication_method)->toBe('manual');
})->with(['municipal', 'offstreet'])->with(['rapid_growth', 'many_missing']);

it('preserves manual corrections and holds conflicting source changes', function (string $type) {
    $this->freezeTime();
    [$source, $admin, $records] = manuallyEstablishDataset($type);
    $model = $type === 'offstreet' ? ParkingOffstreet::class : ParkingMunicipal::class;
    $space = $model::where('external_id', 'record-1')->sole();
    $field = $type === 'offstreet' ? 'name' : 'street';
    $space->forceFill([$field => 'Handmatig gecorrigeerd'])->save();
    $this->travel(1)->days();
    $unchanged = receiveAutomatic($source, $records);
    expect($unchanged->state)->toBe('published');
    expect($space->fresh()->getAttribute($field))->toBe('Handmatig gecorrigeerd');
    $this->travel(1)->days();
    $records[0][$field] = 'Andere bronwaarde';
    $conflict = receiveAutomatic($source->fresh(), $records);

    expect($conflict->state)->toBe('pending');
    expect($conflict->publication_checks['reasons'])->toContain('conflicts', 'review_blocked');
    expect($space->fresh()->getAttribute($field))->toBe('Handmatig gecorrigeerd');
})->with(['municipal', 'offstreet']);

it('does not publish empty offstreet catalogs and flags movements beyond one hundred metres', function () {
    $this->freezeTime();
    [$source, $admin, $records, $previous] = manuallyEstablishDataset('offstreet');
    $this->travel(1)->days();
    $empty = receiveAutomatic($source, []);
    expect($empty->state)->toBe('pending');
    expect($empty->publication_checks['reasons'])->toContain('empty');
    $records[0]['geometry']['coordinates'][0] += 0.0015;
    $moved = receiveAutomatic($source->fresh(), $records);

    expect($moved->state)->toBe('pending');
    expect($moved->publication_checks['reasons'])->toContain('large_movement');
    expect($source->fresh()->last_published_retrieved_at->equalTo($previous->retrieved_at))->toBeTrue();
    $this->assertDatabaseCount('parking_offstreet_spaces', 25);
});

it('requires review for uncertain links new geometry derivations and stale arrivals', function (string $case) {
    $this->freezeTime();
    [$source, $admin, $records, $previous] = manuallyEstablishDataset('municipal');
    $this->travel(1)->days();
    if ($case === 'conflicts') {
        $records[0]['geometry']['coordinates'][0] += 0.00001;
    } elseif ($case === 'geometry_review') {
        $records[0]['geometry'] = ['type' => 'Polygon', 'coordinates' => [[[4.8, 52.3], [4.8001, 52.3001], [4.8, 52.3001], [4.8001, 52.3], [4.8, 52.3]]]];
    }
    $data = automaticDelivery($source, $records);
    if ($case === 'late_delivery') {
        $data['retrieved_at'] = now()->subDays(3)->utc()->format('Y-m-d\TH:i:s.u\Z');
    }
    $import = app(DatasetImports::class)->forSource($source)->intakeFromStorage(json_encode($data, JSON_THROW_ON_ERROR), $source->code, $data['delivery_id']);

    expect($import->state)->toBe('pending');
    expect($import->publication_checks['reasons'])->toContain($case);
    expect($source->fresh()->last_published_retrieved_at->equalTo($previous->retrieved_at))->toBeTrue();
})->with(['conflicts', 'geometry_review', 'late_delivery']);

it('holds accumulated decline relative to the last manual acceptance', function () {
    $this->freezeTime();
    [$source, $admin, $records] = manuallyEstablishDataset('municipal', 100);
    $this->travel(1)->days();
    $second = receiveAutomatic($source, array_slice($records, 2));
    $this->travel(1)->days();
    $third = receiveAutomatic($source->fresh(), array_slice($records, 4));
    $this->travel(1)->days();
    $fourth = receiveAutomatic($source->fresh(), array_slice($records, 6));

    expect($second->state)->toBe('published');
    expect($third->state)->toBe('published');
    expect($fourth->state)->toBe('pending');
    expect($fourth->publication_checks['reasons'])->toContain('gradual_decline');
});

it('asks for a removal review only after accepted missing deliveries span seven days and retains the location', function () {
    $this->freezeTime();
    [$source, $admin, $records] = manuallyEstablishDataset('offstreet');
    $space = ParkingOffstreet::where('external_id', 'record-1')->sole();
    $remaining = array_slice($records, 1);
    $this->travel(1)->days();
    $firstAbsence = receiveAutomatic($source, $remaining);
    $this->travel(1)->days();
    $secondAbsence = receiveAutomatic($source->fresh(), $remaining);
    $this->travel(6)->days();
    $thirdAbsence = receiveAutomatic($source->fresh(), $remaining);

    expect($firstAbsence->state)->toBe('published');
    expect($secondAbsence->state)->toBe('published');
    expect($thirdAbsence->state)->toBe('pending');
    expect($thirdAbsence->publication_checks['reasons'])->toContain('persistent_missing');
    expect($space->fresh()->visibility)->toBeTrue();
    $this->assertDatabaseCount('parking_offstreet_spaces', 25);
});

it('uses the agreed strict percentage minimum and absolute boundaries', function (int $baseline, int $missing, int $new, ?string $reason) {
    $this->freezeTime();
    $source = DatasetSource::factory()->offstreet()->create(['last_published_retrieved_at' => now()->subDay()]);
    DatasetImport::factory()->for($source)->create(['state' => 'published', 'retrieved_at' => now()->subDay(), 'records' => array_fill(0, $baseline, [])]);
    $import = DatasetImport::factory()->for($source)->make(['retrieved_at' => now(), 'records' => array_fill(0, $baseline - $missing + $new, [])]);
    $review = ['rows' => [], 'derivations' => 0, 'blockers' => [], 'counts' => ['new' => $new, 'missing' => $missing, 'changed' => 0, 'unchanged' => $baseline - $missing, 'conflict' => 0]];

    $checks = app(DatasetPublicationPolicy::class)->assess($import, $source, $review);

    expect($checks['reasons'])->toBe($reason ? [$reason] : []);
})->with([
    'two missing in small source' => [10, 2, 0, null],
    'exactly five percent missing' => [100, 5, 0, null],
    'more than five percent missing' => [100, 6, 0, 'many_missing'],
    'fifty missing below percentage' => [2000, 50, 0, null],
    'fifty one missing below percentage' => [2000, 51, 0, 'many_missing'],
    'nine additions in small source' => [10, 0, 9, null],
    'ten additions in small source' => [10, 0, 10, 'rapid_growth'],
    'exactly twenty percent added' => [100, 0, 20, null],
    'more than twenty percent added' => [100, 0, 21, 'rapid_growth'],
    'two hundred additions below percentage' => [2000, 0, 200, null],
    'two hundred one additions below percentage' => [2000, 0, 201, 'rapid_growth'],
]);

it('never overwrites newer publications or repeats automatic publication on an identical delivery', function () {
    $this->freezeTime();
    [$source, $admin, $records] = manuallyEstablishDataset('offstreet');
    $this->travel(1)->days();
    Notification::fake();
    $data = automaticDelivery($source, $records);
    $json = json_encode($data, JSON_THROW_ON_ERROR);
    $service = app(DatasetImports::class)->forSource($source);
    $published = $service->intakeFromStorage($json, $source->code, $data['delivery_id']);
    $repeat = $service->intakeFromStorage($json, $source->code, $data['delivery_id']);
    $older = automaticDelivery($source, $records);
    $older['retrieved_at'] = now()->subHours(12)->utc()->format('Y-m-d\TH:i:s.u\Z');
    $stale = $service->intakeFromStorage(json_encode($older, JSON_THROW_ON_ERROR), $source->code, $older['delivery_id']);
    $equal = receiveAutomatic($source->fresh(), $records);

    expect($repeat->id)->toBe($published->id);
    expect($stale)->state->toBe('pending');
    expect($stale->isSuperseded())->toBeTrue();
    expect($equal->isSuperseded())->toBeTrue();
    expect($source->fresh()->last_published_retrieved_at->equalTo($published->retrieved_at))->toBeTrue();
    $this->assertDatabaseCount('dataset_imports', 4);
    Notification::assertNothingSent();
    expect((new ReadyForReview($published->id, $source->name))->shouldSend($admin, 'database'))->toBeFalse();
});

it('rolls back an automatically accepted upload if archiving fails', function () {
    $this->freezeTime();
    [$source, $admin, $records, $first] = manuallyEstablishDataset('offstreet');
    $this->travel(1)->days();
    Notification::fake();
    $records = automaticRecords('offstreet', 26);
    $this->mock(DatasetDeliveryStorage::class)->shouldReceive('archive')->once()
        ->andThrow(ValidationException::withMessages(['file' => 'Archive unavailable.']));

    expect(fn () => app(DatasetDeliveryService::class)->upload(json_encode(automaticDelivery($source, $records), JSON_THROW_ON_ERROR), $admin))
        ->toThrow(ValidationException::class);

    $this->assertDatabaseCount('parking_offstreet_spaces', 25);
    $this->assertDatabaseCount('dataset_imports', 1);
    expect($source->fresh()->last_published_retrieved_at->equalTo($first->retrieved_at))->toBeTrue();
    Notification::assertNothingSent();
});

it('automatically accepts safe uploads only after their archive succeeds', function () {
    $this->freezeTime();
    [$source, $admin, $records] = manuallyEstablishDataset('municipal');
    $this->travel(1)->days();
    Notification::fake();
    $this->mock(DatasetDeliveryStorage::class)->shouldReceive('archive')->once();

    $import = app(DatasetDeliveryService::class)->upload(json_encode(automaticDelivery($source, $records), JSON_THROW_ON_ERROR), $admin);

    expect($import)->state->toBe('published')->publication_method->toBe('automatic')->submitted_by->toBe($admin->id)->reviewed_by->toBeNull();
    Notification::assertNothingSent();
});

it('keeps the prior publication when a later but already stale delivery arrives', function () {
    $this->freezeTime();
    [$source, $admin, $records, $first] = manuallyEstablishDataset('offstreet');
    $this->travel(10)->days();
    $data = automaticDelivery($source, $records);
    $data['retrieved_at'] = now()->subDays(3)->utc()->format('Y-m-d\TH:i:s.u\Z');

    $import = app(DatasetImports::class)->forSource($source)->intakeFromStorage(json_encode($data, JSON_THROW_ON_ERROR), $source->code, $data['delivery_id']);

    expect($import->publication_checks['reasons'])->toBe(['late_delivery']);
    expect($import->state)->toBe('pending');
    expect($source->fresh()->last_published_retrieved_at->equalTo($first->retrieved_at))->toBeTrue();
});

it('holds accumulated additions relative to manual acceptance even if daily additions stay below the minimum', function () {
    $this->freezeTime();
    [$source] = manuallyEstablishDataset('municipal');
    $this->travel(1)->days();
    $first = receiveAutomatic($source, automaticRecords('municipal', 34));
    $this->travel(1)->days();
    $second = receiveAutomatic($source->fresh(), automaticRecords('municipal', 43));

    expect($first->state)->toBe('published');
    expect($second->state)->toBe('pending');
    expect($second->publication_checks['reasons'])->toBe(['gradual_growth']);
});

it('does not count unpublished missing deliveries toward a removal review', function () {
    $this->freezeTime();
    [$source, $admin, $records] = manuallyEstablishDataset('municipal');
    $remaining = array_slice($records, 1);
    $this->travel(1)->days();
    receiveAutomatic($source, $remaining);
    DatasetImport::factory()->for($source)->create(['state' => 'pending', 'retrieved_at' => now(), 'identity_resolution' => []]);
    DatasetImport::factory()->for($source)->create(['state' => 'rejected', 'retrieved_at' => now(), 'identity_resolution' => []]);
    $this->travel(7)->days();

    $import = receiveAutomatic($source->fresh(), $remaining);

    expect($import->state)->toBe('published');
    expect($import->publication_checks['reasons'])->toBeEmpty();
    $this->assertDatabaseCount('parking_municipal_spaces', 25);
});

it('does not repeatedly hold an accepted disappearance but checks a fresh disappearance after a return', function (string $type) {
    $this->freezeTime();
    [$source, $admin, $records] = manuallyEstablishDataset($type);
    $remaining = array_slice($records, 3);
    $this->travel(1)->days();
    $held = receiveAutomatic($source, $remaining);
    $service = app(DatasetImports::class)->forSource($source);
    $service->decide($held, $admin, 'publish', 'Absence reviewed; retain the locations.', $service->review($held)['token']);
    expect($held->fresh()->publication_checks['acknowledged_missing_ids'])->toHaveCount(3);
    $this->travel(1)->days();
    $next = receiveAutomatic($source->fresh(), $remaining);
    $this->travel(7)->days();
    $later = receiveAutomatic($source->fresh(), $remaining);

    expect($next->state)->toBe('published');
    expect($later->state)->toBe('published');
    expect($later->publication_checks['counts']['newly_missing'])->toBe(0);
    $this->travel(1)->days();
    $return = receiveAutomatic($source->fresh(), $records);
    expect($return->state)->toBe('published');
    $this->travel(1)->days();
    $newAbsence = receiveAutomatic($source->fresh(), $remaining);
    expect($newAbsence->state)->toBe('pending');
    expect($newAbsence->publication_checks['reasons'])->toContain('many_missing');
    $this->assertDatabaseCount($type === 'offstreet' ? 'parking_offstreet_spaces' : 'parking_municipal_spaces', 25);
})->with(['municipal', 'offstreet']);

it('retains the manual comparison anchor after its reviewer is removed', function () {
    $this->freezeTime();
    [$source, $admin, $records, $first] = manuallyEstablishDataset('offstreet');
    $first->forceFill(['reviewed_by' => null])->save();
    $this->travel(1)->days();
    $firstGrowth = receiveAutomatic($source, automaticRecords('offstreet', 34));
    $this->travel(1)->days();
    $nextGrowth = receiveAutomatic($source->fresh(), automaticRecords('offstreet', 43));

    expect($firstGrowth->state)->toBe('published');
    expect($nextGrowth->publication_checks['reasons'])->toBe(['gradual_growth']);
    expect($nextGrowth->publication_checks['reference_import_id'])->toBe($first->id);
});

it('measures persistent absence in elapsed days even when deliveries are more frequent than expected', function () {
    $this->freezeTime();
    [$source, $admin, $records] = manuallyEstablishDataset('offstreet');
    $remaining = array_slice($records, 1);
    $this->travel(1)->days();
    receiveAutomatic($source, $remaining);
    $this->travel(1)->days();
    for ($index = 0; $index < 12; $index++) {
        $this->travel(1)->minutes();
        expect(receiveAutomatic($source->fresh(), $remaining)->state)->toBe('published');
    }
    $this->travel(6)->days();

    $import = receiveAutomatic($source->fresh(), $remaining);

    expect($import->state)->toBe('pending');
    expect($import->publication_checks['reasons'])->toContain('persistent_missing');
});
