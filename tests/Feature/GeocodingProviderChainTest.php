<?php

use App\Models\Country;
use App\Models\Province;
use App\Models\User;
use GuzzleHttp\Promise\PromiseInterface;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;

/**
 * The production order: PDOK, then Geoapify, then public Nominatim.
 */
beforeEach(function () {
    RateLimiter::clear('nominatim-public');
    config([
        'services.geocoding.providers' => ['pdok', 'geoapify', 'nominatim'],
        'services.geoapify.key' => 'test-key',
        'services.nominatim.enabled' => true,
    ]);
});

/**
 * @param  list<array<string, mixed>>  $docs
 */
function pdokDocs(array $docs): Response|PromiseInterface
{
    return Http::response(['response' => ['docs' => $docs]]);
}

function geoapifyPlace(string $name, float $latitude, float $longitude): Response|PromiseInterface
{
    return Http::response(['results' => [['place_id' => Str::slug($name), 'name' => $name, 'result_type' => 'city', 'lat' => $latitude, 'lon' => $longitude]]]);
}

$amsterdam = ['id' => 'wpl-amsterdam', 'type' => 'woonplaats', 'weergavenaam' => 'Amsterdam, Amsterdam, Noord-Holland', 'centroide_ll' => 'POINT(4.89 52.37)'];
$parisiusstraat = ['id' => 'weg-parisius', 'type' => 'weg', 'weergavenaam' => 'Arthur Parisiusstraat, Rotterdam', 'centroide_ll' => 'POINT(4.47 51.92)'];

test('a Dutch destination is resolved by PDOK without asking other providers', function () use ($amsterdam) {
    Http::fake(['api.pdok.nl/*' => pdokDocs([$amsterdam])]);

    $this->getJson('/destinations/resolve?q=Amsterdam')
        ->assertOk()
        ->assertJsonPath('result.key', 'pdok:wpl-amsterdam')
        ->assertJsonPath('result.label', 'Amsterdam')
        ->assertJsonPath('result.type', 'city')
        ->assertJsonPath('result.latitude', 52.37);

    Http::assertSentCount(1);
});

test('an address matches although PDOK places its postcode between the street and the town', function () {
    Http::fake(['api.pdok.nl/*' => pdokDocs([['id' => 'adr-433', 'type' => 'adres', 'weergavenaam' => 'Herengracht 433, 1017BR Amsterdam', 'centroide_ll' => 'POINT(4.888 52.367)']])]);

    $this->getJson('/destinations/resolve?q=Herengracht%20433%20Amsterdam')
        ->assertOk()
        ->assertJsonPath('result.key', 'pdok:adr-433')
        ->assertJsonPath('result.type', 'address');
});

test('a PDOK answer that merely resembles the query falls through to Geoapify', function () use ($parisiusstraat) {
    Http::fake([
        'api.pdok.nl/*' => pdokDocs([$parisiusstraat]),
        'api.geoapify.com/*' => geoapifyPlace('Paris', 48.8566, 2.3522),
    ]);

    $this->getJson('/destinations/resolve?q=Paris')->assertOk()->assertJsonPath('result.label', 'Paris');
});

test('Nominatim answers when PDOK and Geoapify have nothing', function () {
    Http::fake([
        'api.pdok.nl/*' => pdokDocs([]),
        'api.geoapify.com/*' => Http::response(['results' => []]),
        'nominatim.openstreetmap.org/*' => Http::response([['place_id' => 9, 'name' => 'Somewhere', 'lat' => '50.1', 'lon' => '5.1']]),
    ]);

    $this->getJson('/destinations/resolve?q=Somewhere')->assertOk()->assertJsonPath('result.key', 'nominatim:9');
});

test('suggestions put the Dutch match first but keep a place abroad in view', function () use ($amsterdam) {
    Http::fake([
        'api.pdok.nl/*' => pdokDocs([$amsterdam]),
        'api.geoapify.com/*' => geoapifyPlace('Amsterdam, New York', 42.94, -74.19),
    ]);

    $this->getJson('/destinations/suggestions?q=Amsterdam')
        ->assertOk()
        ->assertJsonPath('results.0.key', 'pdok:wpl-amsterdam')
        ->assertJsonPath('results.1.label', 'Amsterdam, New York');

    Http::assertNotSent(fn ($request) => str_contains($request->url(), 'nominatim'));
});

test('suggestions leave out PDOK streets that only contain the query', function () use ($parisiusstraat) {
    Http::fake([
        'api.pdok.nl/*' => pdokDocs([$parisiusstraat]),
        'api.geoapify.com/*' => geoapifyPlace('Paris', 48.8566, 2.3522),
    ]);

    $this->getJson('/destinations/suggestions?q=Paris')
        ->assertOk()
        ->assertJsonCount(1, 'results')
        ->assertJsonPath('results.0.label', 'Paris');
});

test('a failed PDOK request is not remembered as an empty answer', function () use ($amsterdam) {
    Http::fakeSequence('api.pdok.nl/*')->pushStatus(503)->push(['response' => ['docs' => [$amsterdam]]]);
    Http::fake(['api.geoapify.com/*' => Http::response(['results' => []]), 'nominatim.openstreetmap.org/*' => Http::response([])]);

    $this->getJson('/destinations/resolve?q=Amsterdam')->assertOk()->assertJsonPath('result', null);
    RateLimiter::clear('nominatim-public');
    $this->getJson('/destinations/resolve?q=Amsterdam')->assertOk()->assertJsonPath('result.key', 'pdok:wpl-amsterdam');
});

describe('locating a contributed place', function () {
    beforeEach(function () {
        $country = Country::factory()->create(['code' => 'NL', 'name' => 'Nederland']);
        Province::factory()->for($country)->create(['name' => 'Noord-Holland', 'geocode' => 'NL-NH']);
        $this->user = User::factory()->create();
    });

    test('a pin in the Netherlands is described by PDOK', function () {
        Http::fake(['api.pdok.nl/*' => pdokDocs([[
            'type' => 'adres', 'gemeentenaam' => 'Amsterdam', 'woonplaatsnaam' => 'Amsterdam', 'straatnaam' => 'Herengracht',
            'provincienaam' => 'Noord-Holland', 'provincieafkorting' => 'NH', 'postcode' => '1017BR', 'afstand' => 13.5,
        ]])]);

        $this->actingAs($this->user)->getJson(route('location-map.locate', ['latitude' => 52.367, 'longitude' => 4.888]))
            ->assertOk()
            ->assertExactJson(['street' => 'Herengracht', 'municipality' => 'Amsterdam', 'province' => 'Noord-Holland', 'country' => 'Nederland']);

        Http::assertSentCount(1);
    });

    test('PDOK is not asked about a pin outside the Netherlands', function () {
        Http::fake(['api.geoapify.com/*' => Http::response(['results' => [['country_code' => 'be', 'city' => 'Brussel', 'street' => 'Grote Markt']]])]);

        $this->actingAs($this->user)->getJson(route('location-map.locate', ['latitude' => 45.76, 'longitude' => 4.83]));

        Http::assertNotSent(fn ($request) => str_contains($request->url(), 'api.pdok.nl'));
    });

    test('a distant Dutch address for a pin across the border falls through to Geoapify', function () {
        Http::fake([
            'api.pdok.nl/*' => pdokDocs([['type' => 'adres', 'gemeentenaam' => 'Hulst', 'afstand' => 48980.0]]),
            'api.geoapify.com/*' => Http::response(['results' => []]),
            'nominatim.openstreetmap.org/*' => Http::response([]),
        ]);

        $this->actingAs($this->user)->getJson(route('location-map.locate', ['latitude' => 50.85, 'longitude' => 4.35]))->assertUnprocessable();

        Http::assertSent(fn ($request) => str_contains($request->url(), 'api.geoapify.com'));
    });
});
