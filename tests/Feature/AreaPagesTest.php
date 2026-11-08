<?php

use App\Enums\ApiState;
use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingStatus;
use App\Models\Country;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingRule;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceConfirmation;
use App\Models\Province;
use App\Services\AreaPages;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->freezeTime();
    $this->netherlands = Country::factory()->create(['name' => 'Netherlands', 'code' => 'NL']);
    $this->northHolland = Province::factory()->for($this->netherlands)->create(['name' => 'Noord-Holland']);
    $this->amsterdam = Municipality::factory()->for($this->netherlands)->for($this->northHolland)->create(['name' => 'Amsterdam']);
});

it('counts only what the public map shows, with garages and P+R apart', function () {
    $published = ParkingSpace::factory()->for($this->amsterdam)->create(['status' => ParkingStatus::APPROVED]);
    ParkingSpace::factory()->for($this->amsterdam)->create(['status' => ParkingStatus::APPROVED]);
    ParkingSpace::factory()->for($this->amsterdam)->create(['status' => ParkingStatus::PENDING]);
    $municipal = ParkingMunicipal::factory()->for($this->amsterdam)->create(['visibility' => true]);
    ParkingMunicipal::factory()->for($this->amsterdam)->create(['visibility' => true]);
    ParkingMunicipal::factory()->for($this->amsterdam)->create(['visibility' => false]);
    ParkingOffstreet::factory()->for($this->amsterdam)->create(['visibility' => true, 'parking_type' => 'garage', 'api_state' => ApiState::OK, 'occupancy_status' => 'counting', 'free_space' => 12, 'observed_at' => now()->subMinute()]);
    ParkingOffstreet::factory()->for($this->amsterdam)->create(['visibility' => true, 'parking_type' => 'parkandride', 'observed_at' => null, 'api_state' => null]);
    ParkingOffstreet::factory()->for($this->amsterdam)->create(['visibility' => false, 'parking_type' => 'garage']);

    // The official source verifies both visible municipal records, even without a visitor confirmation.
    ParkingSpaceConfirmation::factory()->for($published)->count(2)->create();
    ParkingSpaceConfirmation::factory()->municipal()->create(['parking_municipal_id' => $municipal->id, 'confirmed_at' => now()->subDay()]);
    ParkingSpaceConfirmation::factory()->create(['parking_space_id' => ParkingSpace::query()->where('status', ParkingStatus::APPROVED)->whereKeyNot($published->id)->value('id'), 'status' => ParkingConfirmationStatus::MOVED]);

    $this->get(route('areas.municipality', ['nl', 'amsterdam']))
        ->assertOk()
        ->assertDontSee('name="robots"', false)
        ->assertInertia(fn (Assert $page) => $page
            ->component('frontend/areas/municipality')
            ->where('indexable', true)
            ->where('totals.spaces', 4)
            ->where('totals.verified', 3)
            ->where('totals.garages', 1)
            ->where('totals.live_garages', 1)
            ->where('totals.park_and_ride', 1)
            ->where('totals.live_park_and_ride', 0)
            ->where('totals.last_confirmed_at', now()->startOfSecond()->toISOString())
            ->where('canonical', route('areas.municipality', ['nl', 'amsterdam']))
            ->where('breadcrumbs.0.href', route('areas.country', 'nl'))
            ->where('breadcrumbs.1.href', route('areas.region', ['nl', 'noord-holland']))
            ->where('breadcrumbs.2.href', null));
});

it('hands off to the map around the area without starting a search around the midpoint', function () {
    ParkingSpace::factory()->for($this->amsterdam)->create(['status' => ParkingStatus::APPROVED, 'latitude' => 52.35, 'longitude' => 4.85]);
    ParkingSpace::factory()->for($this->amsterdam)->create(['status' => ParkingStatus::APPROVED, 'latitude' => 52.39, 'longitude' => 4.95]);

    $this->get(route('areas.municipality', ['nl', 'amsterdam']))->assertInertia(fn (Assert $page) => $page
        ->where('map_url', route('location-map', ['view' => 'area', 'south' => 52.35, 'north' => 52.39, 'west' => 4.85, 'east' => 4.95]))
        ->where('preview.bounds', ['south' => 52.35, 'north' => 52.39, 'west' => 4.85, 'east' => 4.95])
        ->where('preview.clusters', fn ($clusters) => collect($clusters)->sum('count') === 2));
});

it('links Amsterdam’s official rules and separate GPKwijs guidance', function () {
    ParkingSpace::factory()->for($this->amsterdam)->create(['status' => ParkingStatus::APPROVED]);
    ParkingRule::factory()->for($this->amsterdam)->for($this->netherlands)->create(['url' => 'https://www.amsterdam.nl/parkeren']);
    ParkingRule::factory()->nationwide()->create(['country_id' => $this->netherlands->id, 'url' => 'https://www.rijksoverheid.nl/parkeren']);

    $this->get(route('areas.municipality', ['nl', 'amsterdam']))->assertInertia(fn (Assert $page) => $page
        ->where('rules.0', ['scope' => 'municipality', 'name' => 'Amsterdam', 'url' => 'https://www.amsterdam.nl/parkeren', 'host' => 'amsterdam.nl'])
        ->where('rules.1.scope', 'country')
        ->where('rules.1.host', 'rijksoverheid.nl')
        ->has('rules', 2)
        ->where('gpkwijs_url', 'https://www.gpkwijs.nl/gemeente/amsterdam'));
});

it('provides only the national rule for a municipality without an official local source', function () {
    $belgium = Country::factory()->create(['code' => 'BE']);
    $province = Province::factory()->for($belgium)->create(['name' => 'Oost-Vlaanderen']);
    $municipality = Municipality::factory()->for($belgium)->for($province)->create(['name' => 'Gent']);
    $national = ParkingRule::factory()->nationwide()->create(['country_id' => $belgium->id, 'url' => 'https://www.belgium.be/nl/mobiliteit']);
    ParkingRule::factory()->for($this->amsterdam)->for($this->netherlands)->create();

    $this->get(route('areas.municipality', ['be', $municipality->slug]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('indexable', false)
            ->has('rules', 1)
            ->where('rules.0.scope', 'country')
            ->where('rules.0.url', $national->url)
            ->where('gpkwijs_url', null));

    $national->delete();

    $this->get(route('areas.municipality', ['be', $municipality->slug]))
        ->assertInertia(fn (Assert $page) => $page->where('rules', [])->where('gpkwijs_url', null));
});

it('keeps a municipality without public parking reachable but out of the index', function () {
    ParkingSpace::factory()->for($this->amsterdam)->create(['status' => ParkingStatus::REJECTED]);

    $this->get(route('areas.municipality', ['nl', 'amsterdam']))
        ->assertOk()
        ->assertSee('<meta data-inertia="robots" name="robots" content="noindex">', false)
        ->assertInertia(fn (Assert $page) => $page->where('indexable', false)->where('totals.spaces', 0)->where('preview', null));

    $this->get(route('sitemap'))->assertOk()->assertDontSee(route('areas.municipality', ['nl', 'amsterdam']));
});

it('links only municipalities with public parking from the region and country', function () {
    $haarlem = Municipality::factory()->for($this->netherlands)->for($this->northHolland)->create(['name' => 'Haarlem']);
    Municipality::factory()->for($this->netherlands)->for($this->northHolland)->create(['name' => 'Texel']);
    ParkingSpace::factory()->for($this->amsterdam)->count(2)->create(['status' => ParkingStatus::APPROVED]);
    ParkingMunicipal::factory()->for($haarlem)->create(['visibility' => true]);

    $this->get(route('areas.region', ['nl', 'noord-holland']))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('frontend/areas/region')
        ->count('municipalities', 2)
        ->where('municipalities.0.name', 'Amsterdam')
        ->where('municipalities.0.municipal', false)
        ->where('municipalities.1.name', 'Haarlem')
        ->where('municipalities.1.municipal', true)
        ->where('municipalities.1.verified', 1)
        ->where('totals.spaces', 3));

    $this->get(route('areas.country', 'nl'))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('frontend/areas/country')
        ->count('municipalities', 2)
        ->where('municipalities.0.name', 'Amsterdam')
        ->where('regions.0.municipalities', 2)
        ->where('totals.verified', 1)
        ->where('without_open_data', 1)
        ->where('sources.open_data', 1));
});

it('names the country in the visitor’s language from its code', function () {
    ParkingSpace::factory()->for($this->amsterdam)->create(['status' => ParkingStatus::APPROVED]);

    $this->withHeader('Accept-Language', 'nl')->get(route('areas.country', 'nl'))
        ->assertSee('<title data-inertia="">Parkeren in Nederland - '.config('app.name').'</title>', false)
        ->assertInertia(fn (Assert $page) => $page->where('name', 'Nederland'));
});

it('keeps the stored name for a country code the visitor’s language does not know', function () {
    $unknown = Country::factory()->create(['name' => 'Testland', 'code' => 'ZZ']);

    expect(app(AreaPages::class)->countryName($unknown))->toBe('Testland');
});

it('lists indexable areas in the sitemap', function () {
    ParkingSpace::factory()->for($this->amsterdam)->create(['status' => ParkingStatus::APPROVED]);

    $this->get(route('sitemap'))
        ->assertOk()
        ->assertHeader('Content-Type', 'text/xml; charset=UTF-8')
        ->assertSee(route('areas.country', 'nl'))
        ->assertSee(route('areas.region', ['nl', 'noord-holland']))
        ->assertSee(route('areas.municipality', ['nl', 'amsterdam']));
});

it('opens the overview at the country with the most public parking', function () {
    ParkingSpace::factory()->for($this->amsterdam)->create(['status' => ParkingStatus::APPROVED]);

    $this->get(route('areas.index'))->assertRedirect(route('areas.country', 'nl'));
});

it('does not find unknown areas or other spellings of a country code', function () {
    $this->get('/areas/nl/municipalities/atlantis')->assertNotFound();
    $this->get('/areas/xx')->assertNotFound();
    $this->get('/areas/NL')->assertNotFound();
});

it('gives each area a stable slug, numbered within its country when taken', function () {
    $second = Municipality::factory()->for($this->netherlands)->for($this->northHolland)->create(['name' => 'Amsterdam']);
    $elsewhere = Municipality::factory()->for(Province::factory()->for(Country::factory()))->create(['name' => 'Amsterdam']);

    expect($this->amsterdam->slug)->toBe('amsterdam')
        ->and($second->slug)->toBe('amsterdam-2')
        ->and($elsewhere->slug)->toBe('amsterdam');

    $this->amsterdam->update(['name' => 'Mokum']);
    expect($this->amsterdam->fresh()->slug)->toBe('amsterdam');
});

it('opens the contact form with the topic an area page links to', function () {
    $this->get(route('contact', ['topic' => 'data']))->assertInertia(fn (Assert $page) => $page->where('topic', 'data'));
    $this->get(route('contact', ['topic' => 'nonsense']))->assertInertia(fn (Assert $page) => $page->where('topic', null));
});
