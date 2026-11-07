<?php

use App\Models\Country;
use App\Models\Municipality;
use App\Models\ParkingSpace;
use App\Models\Province;

it('installs the baseline geography on an empty database', function () {
    $this->assertDatabaseEmpty('countries');
    $this->assertDatabaseEmpty('provinces');

    $this->seed();

    $this->assertDatabaseCount('countries', 249);
    $this->assertDatabaseCount('provinces', 13);

    $netherlands = Country::where('code', 'NL')->sole();
    expect($netherlands->provinces()->orderBy('geocode')->pluck('geocode')->all())->toBe([
        'NL-DR', 'NL-FL', 'NL-FR', 'NL-GE', 'NL-GR', 'NL-LI',
        'NL-NB', 'NL-NH', 'NL-OV', 'NL-UT', 'NL-ZE', 'NL-ZH',
    ]);

    $sweden = Country::where('code', 'SE')->sole();
    expect($sweden->provinces()->sole())->geocode->toBe('SE-AB')->name->toBe('Stockholms län');
});

it('fills missing geography without replacing existing records or their links', function () {
    $country = Country::factory()->create(['code' => 'NL', 'name' => 'Nederland']);
    $province = Province::factory()->for($country)->create(['geocode' => 'NL-NH', 'name' => 'North Holland']);
    $extraProvince = Province::factory()->for($country)->create(['geocode' => 'NL-ZZ']);
    $municipality = Municipality::factory()->for($province)->create();
    $space = ParkingSpace::factory()->for($municipality)->create();

    $this->artisan('nipkaart:sync-geographic-reference')->assertSuccessful();
    $this->artisan('nipkaart:sync-geographic-reference')->assertSuccessful();

    expect($country->fresh()->name)->toBe('Nederland');
    expect($province->fresh())->name->toBe('North Holland')->country_id->toBe($country->id);
    $this->assertModelExists($extraProvince);
    expect($municipality->fresh())->country_id->toBe($country->id)->province_id->toBe($province->id);
    expect($space->fresh())->country_id->toBe($country->id)->province_id->toBe($province->id)->municipality_id->toBe($municipality->id);
    expect($country->provinces()->where('geocode', 'NL-UT')->sole()->name)->toBe('Utrecht');
    $this->assertDatabaseCount('countries', 249);
    $this->assertDatabaseCount('provinces', 14);
});
