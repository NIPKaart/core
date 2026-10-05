<?php

use App\Enums\ParkingStatus;
use App\Enums\UserRole;
use App\Models\Country;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingRule;
use App\Models\ParkingSpace;
use App\Models\Province;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->haarlem = Municipality::factory()->create(['name' => 'Haarlem']);
    $this->zwolle = Municipality::factory()->for($this->haarlem->province)->create(['name' => 'Zwolle']);
});

function municipalityAbroad(): Municipality
{
    return Municipality::factory()->for(Province::factory()->for(Country::factory()))->create();
}

function ruleFor(Municipality|Country $owner, string $url): ParkingRule
{
    return $owner instanceof Country
        ? ParkingRule::create(['country_id' => $owner->id, 'municipality_id' => null, 'url' => $url])
        : ParkingRule::create(['country_id' => $owner->country_id, 'municipality_id' => $owner->id, 'url' => $url]);
}

describe('which source applies', function () {
    test('a municipality\'s own source takes precedence over the country\'s', function () {
        ruleFor($this->haarlem->country, 'https://www.rijksoverheid.nl/regels');
        ruleFor($this->haarlem, 'https://www.haarlem.nl/regels');

        expect(ParkingRule::applicableTo($this->haarlem->country_id, $this->haarlem->id)->forVisitors())
            ->toBe(['url' => 'https://www.haarlem.nl/regels', 'scope' => 'municipality', 'name' => 'Haarlem', 'host' => 'haarlem.nl'])
            ->and(ParkingRule::applicableTo($this->zwolle->country_id, $this->zwolle->id)->forVisitors())
            ->toBe(['url' => 'https://www.rijksoverheid.nl/regels', 'scope' => 'country', 'name' => $this->haarlem->country->name, 'host' => 'rijksoverheid.nl']);
    });

    test('without a source for the municipality or its country there is none, and another country\'s never applies', function () {
        $elsewhere = municipalityAbroad();
        ruleFor($elsewhere->country, 'https://example.org/regels');
        ruleFor($elsewhere, 'https://example.org/gemeente');

        expect(ParkingRule::applicableTo($this->haarlem->country_id, $this->haarlem->id))->toBeNull()
            ->and(ParkingRule::applicableTo(null, null))->toBeNull();
    });

    test('a source knows whether it is country-wide from what it applies to', function () {
        expect(ruleFor($this->haarlem->country, 'https://example.org/land')->nationwide)->toBeTrue()
            ->and(ruleFor($this->haarlem, 'https://example.org/gemeente')->nationwide)->toBeFalse();
    });

    test('the map shows community and municipal places with the one source that applies, or none', function () {
        ruleFor($this->haarlem, 'https://www.haarlem.nl/regels');
        $community = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'country_id' => $this->haarlem->country_id, 'province_id' => $this->haarlem->province_id, 'municipality_id' => $this->haarlem->id]);
        $municipal = ParkingMunicipal::factory()->create(['visibility' => true, 'country_id' => $this->zwolle->country_id, 'province_id' => $this->zwolle->province_id, 'municipality_id' => $this->zwolle->id]);

        $this->getJson(route('map.parking-spaces.show', $community->id))
            ->assertJsonPath('rule.scope', 'municipality')
            ->assertJsonPath('rule.name', 'Haarlem')
            ->assertJsonMissingPath('rule_url');
        $this->getJson(route('map.parking-municipal.show', $municipal->id))->assertJsonPath('rule', null);
    });
});

describe('administration', function () {
    beforeEach(function () {
        $this->actingAs(tap(User::factory()->create())->assignRole(UserRole::ADMIN));
    });

    test('the overview lists each country with its source and coverage, and the municipalities with their own', function () {
        $national = ruleFor($this->haarlem->country, 'https://www.rijksoverheid.nl/regels');
        ruleFor($this->haarlem, 'https://www.haarlem.nl/regels');
        $bare = municipalityAbroad();

        $this->get(route('app.parking-rules.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('backend/parking-rules/index')
                ->where('countries', fn ($countries) => collect($countries)->contains(fn (array $country) => $country['id'] === $this->haarlem->country_id
                    && $country['municipalities'] === 2 && $country['own_sources'] === 1 && $country['rule']['id'] === $national->id)
                    && collect($countries)->contains(fn (array $country) => $country['id'] === $bare->country_id && $country['rule'] === null))
                ->has('rules.data', 1)
                ->where('rules.data.0.municipality.name', 'Haarlem')
                ->missing('availableMunicipalities')
                ->loadDeferredProps(fn (Assert $reload) => $reload
                    ->where('availableMunicipalities', fn ($municipalities) => ! collect($municipalities)->contains('id', $this->haarlem->id)
                        && collect($municipalities)->contains('id', $this->zwolle->id))));
    });

    test('the municipal sources can be searched by municipality', function () {
        ruleFor($this->haarlem, 'https://www.haarlem.nl/regels');
        ruleFor($this->zwolle, 'https://www.zwolle.nl/regels');

        $this->get(route('app.parking-rules.index', ['search' => 'zwol']))
            ->assertInertia(fn (Assert $page) => $page->has('rules.data', 1)->where('rules.data.0.municipality.name', 'Zwolle'));
    });

    test('a source is added for a country or for one of its municipalities', function () {
        $this->post(route('app.parking-rules.store'), ['country_id' => $this->haarlem->country_id, 'nationwide' => true, 'url' => 'https://www.rijksoverheid.nl/regels'])
            ->assertSessionHasNoErrors()->assertRedirect(route('app.parking-rules.index'));
        $this->post(route('app.parking-rules.store'), ['country_id' => $this->haarlem->country_id, 'municipality_id' => $this->haarlem->id, 'nationwide' => false, 'url' => 'https://www.haarlem.nl/regels'])
            ->assertSessionHasNoErrors();

        expect(ParkingRule::query()->whereNull('municipality_id')->value('url'))->toBe('https://www.rijksoverheid.nl/regels')
            ->and(ParkingRule::query()->where('municipality_id', $this->haarlem->id)->value('url'))->toBe('https://www.haarlem.nl/regels');
    });

    test('a source needs a municipality of the chosen country, one per municipality, and a secure official link', function () {
        $elsewhere = municipalityAbroad();
        ruleFor($this->haarlem, 'https://www.haarlem.nl/regels');
        $base = ['country_id' => $this->haarlem->country_id, 'nationwide' => false, 'url' => 'https://example.org/regels'];

        $this->post(route('app.parking-rules.store'), [...$base, 'municipality_id' => $elsewhere->id])->assertSessionHasErrors('municipality_id');
        $this->post(route('app.parking-rules.store'), [...$base, 'municipality_id' => $this->haarlem->id])->assertSessionHasErrors('municipality_id');
        $this->post(route('app.parking-rules.store'), [...$base, 'municipality_id' => $this->zwolle->id, 'url' => 'http://www.zwolle.nl/regels'])->assertSessionHasErrors('url');
        $this->post(route('app.parking-rules.store'), [...$base, 'municipality_id' => null])->assertSessionHasErrors('municipality_id');

        expect(ParkingRule::count())->toBe(1);
    });

    test('editing changes only the page a source points to', function () {
        $rule = ruleFor($this->haarlem, 'https://www.haarlem.nl/oud');

        $this->put(route('app.parking-rules.update', $rule), ['url' => 'https://www.haarlem.nl/nieuw', 'municipality_id' => $this->zwolle->id])
            ->assertSessionHasNoErrors();

        expect($rule->fresh())->url->toBe('https://www.haarlem.nl/nieuw')->municipality_id->toBe($this->haarlem->id);
    });

    test('removing a municipality\'s source lets the country\'s apply again', function () {
        ruleFor($this->haarlem->country, 'https://www.rijksoverheid.nl/regels');
        $own = ruleFor($this->haarlem, 'https://www.haarlem.nl/regels');

        $this->delete(route('app.parking-rules.destroy', $own))->assertRedirect(route('app.parking-rules.index'));

        expect(ParkingRule::applicableTo($this->haarlem->country_id, $this->haarlem->id)->forVisitors()['scope'])->toBe('country');
    });
});
