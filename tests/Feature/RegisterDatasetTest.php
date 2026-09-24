<?php

use App\Models\DatasetSource;

it('refuses unknown datasets without registering a source', function () {
    $municipality = DatasetSource::factory()->make()->municipality;

    $this->artisan('nipkaart:register-dataset', ['dataset' => 'nl-unknown', 'municipality' => $municipality->id])
        ->expectsOutput('Unknown dataset: nl-unknown')
        ->assertFailed();

    $this->assertDatabaseCount('dataset_sources', 0);
});

it('registers an additional configured dataset without a city specific command', function () {
    $municipality = DatasetSource::factory()->make()->municipality;
    config(['municipal-deliveries.sources.nl-extra' => [
        'municipality' => ['name' => $municipality->name, 'country' => 'NL', 'province' => 'NL-NH'],
        'registration' => [
            'name' => 'Additional source', 'selection' => 'all', 'target_type' => 'municipal',
            'source_url' => 'https://example.com/data', 'attribution' => 'Additional source attribution',
            'terms_url' => 'https://example.com/terms', 'bounds' => [4.65, 52.2, 5.15, 52.5],
        ],
    ]]);

    $this->artisan('nipkaart:register-dataset', ['dataset' => 'nl-extra', 'municipality' => $municipality->id])
        ->assertSuccessful();

    $this->assertDatabaseHas('dataset_sources', [
        'code' => 'nl-extra', 'municipality_id' => $municipality->id,
        'name' => 'Additional source', 'selection' => 'all', 'publication_enabled' => false,
    ]);
});

it('refuses a missing municipality without registering a source', function () {
    $this->artisan('nipkaart:register-dataset', ['dataset' => 'nl-amsterdam', 'municipality' => 0])
        ->assertFailed();

    $this->assertDatabaseCount('dataset_sources', 0);
});

it('refuses a municipality in another country', function () {
    $municipality = DatasetSource::factory()->make()->municipality;
    $municipality->country->update(['code' => 'BE']);

    $this->artisan('nipkaart:register-dataset', ['dataset' => 'nl-amsterdam', 'municipality' => $municipality->id])
        ->assertFailed();

    $this->assertDatabaseCount('dataset_sources', 0);
});
