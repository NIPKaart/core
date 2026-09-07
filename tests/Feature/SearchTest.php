<?php

use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use Meilisearch\Client;

test('blank search avoids the search server', function () {
    $client = Mockery::mock(Client::class);
    $client->shouldNotReceive('multiSearch');
    $this->app->instance(Client::class, $client);
    $this->getJson('/api/search?q=')->assertExactJson(['hits' => [], 'estimatedTotalHits' => 0]);
});

test('search uses configured indexes and only applies postcode filters to documents with postcodes', function () {
    config(['scout.prefix' => 'test_']);
    $client = Mockery::mock(Client::class);
    $client->shouldReceive('multiSearch')->once()->withArgs(function (array $queries) {
        $queries = array_map(fn ($query) => $query->toArray(), $queries);
        expect(array_column($queries, 'indexUid'))->toBe([
            (new ParkingSpace)->searchableAs(),
            (new ParkingOffstreet)->searchableAs(),
            (new ParkingMunicipal)->searchableAs(),
        ]);
        expect(json_encode($queries[0]['filter']))->toContain('postcode');
        expect(json_encode($queries[1]['filter']))->not->toContain('postcode');
        expect(json_encode($queries[2]['filter']))->not->toContain('postcode');
        expect(config('scout.meilisearch.index-settings.'.ParkingSpace::class.'.filterableAttributes'))->toContain('postcode');

        return true;
    })->andReturn(['results' => [
        ['indexUid' => 'test_parking_spaces', 'estimatedTotalHits' => 1, 'hits' => [
            ['id' => '1', 'street' => 'Community street', 'city' => 'Amsterdam', '_geo' => ['lat' => 52.1, 'lng' => 4.2]],
        ]],
        ['indexUid' => 'test_parking_offstreet_spaces', 'estimatedTotalHits' => 1, 'hits' => [
            ['id' => '2', 'name' => 'Garage', 'latitude' => '52.2', 'longitude' => '4.3'],
        ]],
        ['indexUid' => 'test_parking_municipal_spaces', 'estimatedTotalHits' => 1, 'hits' => [
            ['id' => '3', 'street' => 'Municipal street', 'number' => 2],
        ]],
    ]]);
    $this->app->instance(Client::class, $client);

    $this->getJson('/api/search?q='.urlencode('Amsterdam, street 1234 AB'))
        ->assertOk()->assertJsonPath('estimatedTotalHits', 3)
        ->assertJsonPath('hits.0.type', 'community')->assertJsonPath('hits.0.lat', 52.1)
        ->assertJsonPath('hits.1.type', 'offstreet')->assertJsonPath('hits.1.lng', 4.3)
        ->assertJsonPath('hits.2.type', 'municipal')->assertJsonPath('hits.2.lat', null);
});
