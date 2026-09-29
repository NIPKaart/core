<?php

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Models\Municipality;
use App\Models\ParkingSpace;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Notification::fake();
    $this->user = User::factory()->create();
    $this->municipality = Municipality::factory()->create();
});

/**
 * @return array<string, mixed>
 */
function placeAt(float $latitude = 52.37, float $longitude = 4.9): array
{
    return ['latitude' => $latitude, 'longitude' => $longitude, 'orientation' => ParkingOrientation::PARALLEL->value, 'under_sign' => 'no'];
}

describe('locating the pin', function () {
    test('describes where the pin lies without storing anything', function () {
        fakeReverseGeocoding($this->municipality, ['city' => 'Brand New Town']);

        $this->actingAs($this->user)->getJson(route('location-map.locate', ['latitude' => 52.37, 'longitude' => 4.9]))
            ->assertOk()
            ->assertExactJson([
                'street' => 'Teststraat',
                'municipality' => 'Brand New Town',
                'province' => $this->municipality->province->name,
                'country' => $this->municipality->country->name,
            ]);

        expect(Municipality::where('name', 'Brand New Town')->exists())->toBeFalse();
    });

    test('names a known province as NIPKaart stores it, whatever language the provider answers in', function () {
        $this->municipality->province->update(['geocode' => 'NL-NH', 'name' => 'Noord-Holland']);
        fakeReverseGeocoding($this->municipality, ['state' => 'North Holland', 'state_code' => 'NH', 'country_code' => 'nl']);
        $this->municipality->country->update(['code' => 'NL']);

        $this->actingAs($this->user)->getJson(route('location-map.locate', ['latitude' => 52.37, 'longitude' => 4.9]))
            ->assertJsonPath('province', 'Noord-Holland');
    });

    test('refuses a pin without a municipality in a supported country', function (array $address) {
        fakeReverseGeocoding($this->municipality, $address);

        $this->actingAs($this->user)->getJson(route('location-map.locate', ['latitude' => 52.37, 'longitude' => 4.9]))
            ->assertUnprocessable()
            ->assertJsonPath('message', __('parking_spaces.contribute.unresolved'));
    })->with([
        'unsupported country' => [['country_code' => 'zz']],
        'no municipality' => [['city' => null]],
    ]);

    test('falls back to public Nominatim when Geoapify fails', function () {
        RateLimiter::clear('nominatim-public');
        config(['services.geoapify.key' => 'test-key', 'services.nominatim.enabled' => true]);
        Http::fake([
            'api.geoapify.com/*' => Http::response([], 500),
            'nominatim.openstreetmap.org/reverse*' => Http::response(['address' => [
                'country_code' => strtolower($this->municipality->country->code),
                'state' => $this->municipality->province->name,
                'municipality' => $this->municipality->name,
                'road' => 'Fallbackweg',
            ]]),
        ]);

        $this->actingAs($this->user)->getJson(route('location-map.locate', ['latitude' => 52.37, 'longitude' => 4.9]))
            ->assertOk()
            ->assertJsonPath('street', 'Fallbackweg');
    });

    test('reuses a recent lookup for the same spot', function () {
        fakeReverseGeocoding($this->municipality);

        $this->actingAs($this->user)->getJson(route('location-map.locate', ['latitude' => 52.370001, 'longitude' => 4.9]))->assertOk();
        $this->getJson(route('location-map.locate', ['latitude' => 52.370002, 'longitude' => 4.9]))->assertOk();

        Http::assertSentCount(1);
    });
});

describe('submitting', function () {
    test('files the place where the server resolves it, ignoring any address the browser sends', function () {
        fakeReverseGeocoding($this->municipality);
        $elsewhere = Municipality::factory()->create();

        $this->actingAs($this->user)->post(route('location-map.store'), [
            ...placeAt(),
            'nominatim' => json_encode(['country_code' => $elsewhere->country->code, 'city' => $elsewhere->name]),
        ])->assertSessionHasNoErrors();

        expect($this->user->parkingSpaces()->sole())
            ->municipality_id->toBe($this->municipality->id)
            ->street->toBe('Teststraat')
            ->status->toBe(ParkingStatus::PENDING);
    });

    test('files a municipality seen for the first time', function () {
        fakeReverseGeocoding($this->municipality, ['city' => 'Brand New Town']);

        $this->actingAs($this->user)->post(route('location-map.store'), placeAt())->assertSessionHasNoErrors();

        expect($this->user->parkingSpaces()->sole()->municipality->name)->toBe('Brand New Town');
    });

    test('refuses a place that cannot be located', function () {
        fakeReverseGeocoding($this->municipality, ['country_code' => 'zz']);

        $this->actingAs($this->user)->post(route('location-map.store'), placeAt())->assertSessionHasErrors('latitude');

        expect(ParkingSpace::count())->toBe(0);
    });

    test('confirms the submission only to its contributor', function () {
        fakeReverseGeocoding($this->municipality);
        $this->actingAs($this->user)->post(route('location-map.store'), placeAt());
        $space = $this->user->parkingSpaces()->sole();

        $this->get(route('location-map.submitted', $space))
            ->assertInertia(fn (Assert $page) => $page->component('frontend/map/submitted')->where('parkingSpace.id', $space->id));
        $this->actingAs(User::factory()->create())->get(route('location-map.submitted', $space))->assertForbidden();
    });

    test('the add page no longer ships every known place', function () {
        ParkingSpace::factory()->count(3)->create();

        $this->actingAs($this->user)->get(route('location-map.add'))
            ->assertInertia(fn (Assert $page) => $page->component('frontend/map/contribute')->missing('parkingSpaces')->where('parkingSpace', null));
    });
});

describe('editing a pending submission', function () {
    test('the contributor can move and correct it', function () {
        $space = ParkingSpace::factory()->for($this->user)->create(['status' => ParkingStatus::PENDING]);
        fakeReverseGeocoding($this->municipality);

        $this->actingAs($this->user)->get(route('location-map.edit', $space))
            ->assertInertia(fn (Assert $page) => $page->component('frontend/map/contribute')->where('parkingSpace.id', $space->id));

        $this->put(route('location-map.update', $space), [...placeAt(52.38, 4.91), 'orientation' => 'angle'])
            ->assertRedirect(route('profile.parking-spaces.show', $space->id));

        expect($space->fresh())
            ->latitude->toBe(52.38)
            ->orientation->value->toBe('angle')
            ->municipality_id->toBe($this->municipality->id);
    });

    test('is closed to other users and once moderated', function (Closure $space, Closure $actor) {
        $space = $space($this->user);

        $this->actingAs($actor($this->user))->get(route('location-map.edit', $space))->assertForbidden();
        $this->put(route('location-map.update', $space), placeAt())->assertForbidden();
    })->with([
        'someone else' => [fn (User $owner) => ParkingSpace::factory()->for($owner)->create(['status' => ParkingStatus::PENDING]), fn () => User::factory()->create()],
        'approved' => [fn (User $owner) => ParkingSpace::factory()->for($owner)->create(['status' => ParkingStatus::APPROVED]), fn (User $owner) => $owner],
    ]);
});
