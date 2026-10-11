<?php

use App\Enums\ParkingStatus;
use App\Models\Country;
use App\Models\Municipality;
use App\Models\ParkingSpace;
use App\Models\Province;
use App\Services\LegacyCommunityImport;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;

/** @return array<string, list<array<string, ?string>>> */
function legacyCommunityTables(array $space = [], array $rule = []): array
{
    return [
        'countries' => [['id' => '156', 'name' => 'Netherlands', 'code' => 'NL']],
        'provinces' => [['id' => '8', 'country_id' => '156', 'name' => 'Noord-Holland', 'geocode' => 'NL-NH']],
        'location_status' => [['id' => '2', 'name' => 'Approved'], ['id' => '1', 'name' => 'In review'], ['id' => '3', 'name' => 'Declined']],
        'parking_locations' => [[
            'id' => 'old-place-123', 'country_id' => '156', 'province_id' => '8', 'municipality' => 'Amsterdam',
            'user_id' => '999', 'ip_address' => '192.0.2.1', 'city' => 'Amsterdam', 'suburb' => null, 'neighbourhood' => null,
            'postcode' => '1000 AA', 'street' => "O'Brienstraat", 'amenity' => null, 'description' => "Note, with (brackets); and\nnew line",
            'latitude' => '52.370216', 'longitude' => '4.895168', 'orientation' => 'Haaks', 'parking_time' => null,
            'parking_disc' => '0', 'window_times' => '0', 'status_id' => '2', 'deleted_at' => null,
            'created_at' => '2020-01-02 03:04:05', 'updated_at' => '2021-02-03 04:05:06', ...$space,
        ]],
        'parking_rules' => [[
            'id' => '10', 'country_id' => '156', 'municipality' => 'Amsterdam', 'nationwide' => '0',
            'url' => 'https://example.org/rules', 'created_at' => '2020-01-02 03:04:05', 'updated_at' => '2021-02-03 04:05:06', ...$rule,
        ]],
    ];
}

it('previews the transfer without creating any records', function () {
    $result = app(LegacyCommunityImport::class)->run(legacyCommunityTables());

    expect($result)->toMatchArray(['new_spaces' => 1, 'new_rules' => 1, 'approved' => 1, 'municipalities' => 1]);
    foreach (['countries', 'provinces', 'municipalities', 'parking_spaces', 'parking_rules', 'users'] as $table) {
        $this->assertDatabaseCount($table, 0);
    }
});

it('preserves source status and text while excluding accounts and imported parking data', function () {
    Notification::fake();
    Queue::fake();
    $tables = legacyCommunityTables();
    $tables['parking_cities'] = [['id' => 'municipal', 'country_id' => '156', 'province_id' => '8', 'municipality' => 'Amsterdam']];
    $tables['parking_offstreet'] = [['id' => 'garage', 'country_id' => '156', 'province_id' => '8', 'municipality' => 'Amsterdam']];

    $result = app(LegacyCommunityImport::class)->run($tables, true);

    expect($result)->toMatchArray(['new_spaces' => 1, 'new_rules' => 1]);
    $this->assertDatabaseHas('parking_spaces', [
        'user_id' => null, 'ip_address' => null, 'status' => 'approved', 'orientation' => 'perpendicular',
        'street' => "O'Brienstraat", 'description' => "Note, with (brackets); and\nnew line", 'under_sign' => null,
        'created_at' => '2020-01-02 03:04:05', 'updated_at' => '2021-02-03 04:05:06',
    ]);
    expect(ParkingSpace::sole()->id)->toMatch('/^[0-9a-f-]{36}$/');
    $this->assertDatabaseHas('parking_rules', ['country_id' => Country::sole()->id, 'municipality_id' => Municipality::sole()->id, 'url' => 'https://example.org/rules', 'nationwide' => false]);
    foreach (['users', 'favorites', 'parking_municipal_spaces', 'parking_offstreet_spaces', 'parking_space_reviews', 'notifications'] as $table) {
        $this->assertDatabaseCount($table, 0);
    }
    expect(DB::selectOne('SELECT ST_SRID(location::geometry) AS srid FROM parking_spaces')->srid)->toBe(4326);
    Notification::assertNothingSent();
    Queue::assertNothingPushed();
});

it('retains pending rejected and deleted states without inventing under-sign absence', function (array $source, array $expected) {
    app(LegacyCommunityImport::class)->run(legacyCommunityTables($source), true);

    $this->assertDatabaseHas('parking_spaces', $expected);
})->with([
    'pending' => [['status_id' => '1'], ['status' => 'pending', 'under_sign' => null]],
    'rejected' => [['status_id' => '3'], ['status' => 'rejected', 'under_sign' => null]],
    'time restriction' => [['parking_time' => '60', 'parking_disc' => '1'], ['parking_time' => 60, 'parking_disc' => true, 'under_sign' => 'yes']],
    'window times' => [['window_times' => '1'], ['under_sign' => 'yes', 'restriction_days' => null]],
    'deleted' => [['deleted_at' => '2022-01-01 00:00:00'], ['deleted_at' => '2022-01-01 00:00:00']],
]);

it('reuses target geography and is unchanged on a repeated transfer', function () {
    $country = Country::factory()->create(['code' => 'NL']);
    $province = Province::factory()->create(['country_id' => $country->id, 'geocode' => 'NL-NH']);
    $municipality = Municipality::factory()->create(['country_id' => $country->id, 'province_id' => $province->id, 'name' => 'Gemeente Amsterdam']);
    app(LegacyCommunityImport::class)->run(legacyCommunityTables(), true);

    $result = app(LegacyCommunityImport::class)->run(legacyCommunityTables(), true);

    expect($result)->toMatchArray(['new_spaces' => 0, 'new_rules' => 0, 'unchanged_spaces' => 1, 'unchanged_rules' => 1]);
    $this->assertDatabaseCount('countries', 1);
    $this->assertDatabaseCount('provinces', 1);
    $this->assertDatabaseCount('municipalities', 1);
    $this->assertDatabaseCount('parking_spaces', 1);
    $this->assertDatabaseCount('parking_rules', 1);
    $this->assertDatabaseHas('parking_spaces', ['municipality_id' => $municipality->id]);
});

it('matches a municipality within its province when another province has the same name', function () {
    $country = Country::factory()->create(['code' => 'NL']);
    $northHolland = Province::factory()->create(['country_id' => $country->id, 'geocode' => 'NL-NH']);
    $limburg = Province::factory()->create(['country_id' => $country->id, 'geocode' => 'NL-LI']);
    $sourceMunicipality = Municipality::factory()->create(['country_id' => $country->id, 'province_id' => $northHolland->id, 'name' => 'Bergen']);
    $otherMunicipality = Municipality::factory()->create(['country_id' => $country->id, 'province_id' => $limburg->id, 'name' => 'Bergen']);

    app(LegacyCommunityImport::class)->run(legacyCommunityTables(['municipality' => 'Bergen'], ['municipality' => 'Bergen']), true);

    $this->assertDatabaseCount('municipalities', 2);
    $this->assertDatabaseHas('parking_spaces', ['municipality_id' => $sourceMunicipality->id, 'province_id' => $northHolland->id]);
    $this->assertDatabaseHas('parking_rules', ['municipality_id' => $sourceMunicipality->id]);
    $this->assertDatabaseMissing('parking_spaces', ['municipality_id' => $otherMunicipality->id]);
    $this->assertDatabaseMissing('parking_rules', ['municipality_id' => $otherMunicipality->id]);
});

it('rolls back new places when an existing rule conflicts', function () {
    app(LegacyCommunityImport::class)->run(legacyCommunityTables(), true);
    $tables = legacyCommunityTables(['id' => 'second-place'], ['url' => 'https://example.org/different']);

    expect(fn () => app(LegacyCommunityImport::class)->run($tables, true))->toThrow(InvalidArgumentException::class);

    $this->assertDatabaseCount('parking_spaces', 1);
    $this->assertDatabaseHas('parking_rules', ['url' => 'https://example.org/rules']);
});

it('refuses to overwrite a community place changed after migration', function () {
    app(LegacyCommunityImport::class)->run(legacyCommunityTables(), true);
    DB::table('parking_spaces')->update(['status' => ParkingStatus::PENDING->value]);

    expect(fn () => app(LegacyCommunityImport::class)->run(legacyCommunityTables(), true))->toThrow(InvalidArgumentException::class);

    $this->assertDatabaseHas('parking_spaces', ['status' => 'pending']);
});

it('rejects invalid legacy records before writing', function (array $space, array $rule) {
    expect(fn () => app(LegacyCommunityImport::class)->run(legacyCommunityTables($space, $rule), true))->toThrow(InvalidArgumentException::class);

    $this->assertDatabaseCount('parking_spaces', 0);
    $this->assertDatabaseCount('parking_rules', 0);
    $this->assertDatabaseCount('municipalities', 0);
})->with([
    'coordinates' => [['latitude' => '91'], []],
    'status' => [['status_id' => '99'], []],
    'orientation' => [['orientation' => 'unknown'], []],
    'missing province' => [['province_id' => '99'], []],
    'ambiguous rule municipality' => [[], ['municipality' => 'Unknown city']],
    'unsafe rule URL' => [[], ['url' => 'javascript:alert(1)']],
]);

it('keeps nationwide rules independent of a municipality', function () {
    app(LegacyCommunityImport::class)->run(legacyCommunityTables([], ['nationwide' => '1', 'municipality' => 'Nederland']), true);

    $this->assertDatabaseHas('parking_rules', ['municipality_id' => null, 'nationwide' => true]);
});

it('provides a preview by default and commits only with the write option', function () {
    $path = tempnam(sys_get_temp_dir(), 'legacy-command-');
    $sql = '';
    foreach (legacyCommunityTables() as $table => $rows) {
        $columns = array_keys($rows[0]);
        $sql .= "CREATE TABLE `{$table}` (\n".implode(",\n", array_map(fn ($column) => "  `{$column}` text", $columns))."\n) ENGINE=InnoDB;\n";
        foreach ($rows as $row) {
            $values = array_map(fn ($value) => $value === null ? 'NULL' : "'".str_replace(['\\', "'", "\n"], ['\\\\', "\\'", '\\n'], $value)."'", array_values($row));
            $sql .= "INSERT INTO `{$table}` VALUES (".implode(',', $values).");\n";
        }
    }
    file_put_contents($path, $sql."-- Dump completed on 2026-10-09 10:00:00\n");

    try {
        $this->artisan('nipkaart:import-legacy-community', ['dump' => $path])->expectsOutputToContain('Read-only preview')->assertSuccessful();
        $this->assertDatabaseCount('parking_spaces', 0);
        $this->artisan('nipkaart:import-legacy-community', ['dump' => $path, '--write' => true])->expectsOutputToContain('Transfer committed')->assertSuccessful();
        $this->assertDatabaseCount('parking_spaces', 1);
    } finally {
        unlink($path);
    }
});
