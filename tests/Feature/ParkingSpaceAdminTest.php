<?php

use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingStatus;
use App\Enums\UserRole;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingPlaceReport;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceConfirmation;
use App\Models\ParkingSpaceImprovement;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = tap(User::factory()->create())->assignRole(UserRole::ADMIN);
});

test('the list counts each status tab and the trash', function () {
    ParkingSpace::factory()->count(2)->create(['status' => ParkingStatus::PENDING]);
    ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
    ParkingSpace::factory()->create(['status' => ParkingStatus::REJECTED])->delete();

    $this->actingAs($this->admin)->get(route('app.parking-spaces.index', ['status' => 'pending']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('tabCounts', ['all' => 3, 'pending' => 2, 'approved' => 1, 'rejected' => 0, 'trash' => 1])
            ->where('filters.status', 'pending')
            ->has('spaces.data', 2));
});

test('search finds a parking space by street, postcode, place or contributor', function () {
    $contributor = User::factory()->create(['name' => 'Lotte Mulder']);
    ParkingSpace::factory()->for($contributor)->create(['street' => 'Kerkstraat 12', 'postcode' => '2011 HL', 'city' => 'Haarlem']);
    ParkingSpace::factory()->for(User::factory()->create(['name' => 'Jan Bakker']))->create(['street' => 'Oudegracht 7', 'postcode' => '3511 AB', 'city' => 'Utrecht']);

    $this->actingAs($this->admin);
    foreach (['kerkstraat', '2011 hl', 'haarl', 'lotte'] as $search) {
        $this->get(route('app.parking-spaces.index', ['search' => $search]))
            ->assertInertia(fn (Assert $page) => $page->has('spaces.data', 1)->where('spaces.data.0.street', 'Kerkstraat 12'));
    }
    $this->get(route('app.parking-spaces.index', ['search' => '100%']))
        ->assertInertia(fn (Assert $page) => $page->has('spaces.data', 0));
});

test('each row carries the signals that ask for attention, and the list filters on them', function () {
    $reported = ParkingSpace::factory()->for(User::factory())->create(['status' => ParkingStatus::APPROVED]);
    ParkingPlaceReport::factory()->count(2)->create(['parking_space_id' => $reported->id]);
    ParkingPlaceReport::factory()->create(['parking_space_id' => $reported->id, 'resolved_at' => now()]);
    $improved = ParkingSpace::factory()->for(User::factory())->create(['status' => ParkingStatus::APPROVED]);
    ParkingSpaceImprovement::factory()->create(['parking_space_id' => $improved->id]);
    $nearby = ParkingSpace::factory()->for(User::factory())->create(['status' => ParkingStatus::PENDING, 'latitude' => 52.08270, 'longitude' => 4.31410]);
    ParkingMunicipal::factory()->create(['visibility' => true, 'latitude' => 52.08275, 'longitude' => 4.31415]);
    ParkingSpace::factory()->for(User::factory())->create(['status' => ParkingStatus::APPROVED]);

    $this->actingAs($this->admin);
    $this->get(route('app.parking-spaces.index', ['signal' => 'reports']))
        ->assertInertia(fn (Assert $page) => $page->has('spaces.data', 1)
            ->where('spaces.data.0.id', $reported->id)
            ->where('spaces.data.0.open_reports_count', 2));
    $this->get(route('app.parking-spaces.index', ['signal' => 'improvement']))
        ->assertInertia(fn (Assert $page) => $page->has('spaces.data', 1)
            ->where('spaces.data.0.id', $improved->id)
            ->where('spaces.data.0.open_improvements_count', 1));
    $this->get(route('app.parking-spaces.index', ['signal' => 'nearby_municipal']))
        ->assertInertia(fn (Assert $page) => $page->has('spaces.data', 1)
            ->where('spaces.data.0.id', $nearby->id)
            ->where('spaces.data.0.nearby_municipal_metres', fn (int $metres) => $metres < 30));
    $this->get(route('app.parking-spaces.index', ['signal' => 'unknown']))
        ->assertInertia(fn (Assert $page) => $page->has('spaces.data', 4)->where('filters.signal', null));
});

test('the oldest parking spaces come first on request', function () {
    $this->travelTo('2026-01-01 09:00:00');
    $oldest = ParkingSpace::factory()->create();
    $this->travelTo('2026-02-01 09:00:00');
    ParkingSpace::factory()->create();

    $this->actingAs($this->admin)->get(route('app.parking-spaces.index', ['sort' => 'oldest']))
        ->assertInertia(fn (Assert $page) => $page->where('spaces.data.0.id', $oldest->id)->where('filters.sort', 'oldest'));
});

test('several parking spaces move to the trash at once', function () {
    $spaces = ParkingSpace::factory()->count(2)->create();
    $kept = ParkingSpace::factory()->create();

    $this->actingAs($this->admin)
        ->delete(route('app.parking-spaces.bulk.destroy'), ['ids' => $spaces->pluck('id')->all()])
        ->assertRedirect();

    expect(ParkingSpace::onlyTrashed()->pluck('id')->sort()->values()->all())->toBe($spaces->pluck('id')->sort()->values()->all())
        ->and($kept->fresh()->trashed())->toBeFalse();
});

test('moving several parking spaces to the trash needs the delete permission', function () {
    $space = ParkingSpace::factory()->create();

    $this->actingAs(User::factory()->create())
        ->delete(route('app.parking-spaces.bulk.destroy'), ['ids' => [$space->id]])
        ->assertForbidden();

    expect($space->fresh()->trashed())->toBeFalse();
});

test('the detail page leads with what waits on the parking space and summarises its confirmations and history', function () {
    $moderator = User::factory()->create(['name' => 'Klaas Schoute']);
    $this->travelTo('2026-03-18 21:40:00');
    $space = ParkingSpace::factory()->for(User::factory()->create(['name' => 'Lotte Mulder']))->create(['status' => ParkingStatus::PENDING]);
    $this->travelTo('2026-03-19 09:12:00');
    $space->fill(['status' => ParkingStatus::APPROVED])->saveReviewedBy($moderator);
    $this->travelTo('2026-09-30 10:00:00');
    ParkingSpaceImprovement::factory()->for(User::factory()->create(['name' => 'Sanne Yilmaz']))->create(['parking_space_id' => $space->id, 'submitted' => ['under_sign' => 'yes', 'description' => 'Nieuw bord']]);
    ParkingSpaceConfirmation::factory()->for(User::factory())->for($space)->count(2)->create();
    ParkingSpaceConfirmation::factory()->for(User::factory())->for($space)->create(['status' => ParkingConfirmationStatus::MOVED]);
    $this->travelTo('2026-10-05 09:00:00');

    $this->actingAs($this->admin)->get(route('app.parking-spaces.show', $space))
        ->assertInertia(fn (Assert $page) => $page
            ->where('openImprovement.proposer', 'Sanne Yilmaz')
            ->where('openImprovement.changes', ['under_sign', 'description'])
            ->where('confirmations.total', 3)
            ->where('confirmations.counts', ['confirmed' => 2, 'moved' => 1, 'unavailable' => 0])
            ->has('confirmations.recent', 3)
            ->where('history.0.kind', 'improvement')
            ->where('history.1', ['kind' => 'review', 'at' => '2026-03-19T09:12:00+00:00', 'by' => 'Klaas Schoute', 'status' => 'approved', 'reason' => null])
            ->where('history.2.kind', 'added')
            ->where('history.2.by', 'Lotte Mulder')
            ->where('parkingSpace.user.parking_spaces_count', 1)
            ->where('parkingSpace.user.published_spaces_count', 1)
            ->where('mapUrl', fn (string $url) => str_contains(urldecode($url), "community:{$space->id}")));
});

test('a parking space that is not on the map gets no public map link', function () {
    $space = ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING]);

    $this->actingAs($this->admin)->get(route('app.parking-spaces.show', $space))
        ->assertInertia(fn (Assert $page) => $page->where('mapUrl', null)->where('openImprovement', null));
});

test('the confirmations page counts every outcome, not only the current page', function () {
    $space = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
    ParkingSpaceConfirmation::factory()->for(User::factory())->for($space)->count(21)->create();
    ParkingSpaceConfirmation::factory()->for(User::factory())->for($space)->create(['status' => ParkingConfirmationStatus::UNAVAILABLE]);

    $this->actingAs($this->admin)->get(route('app.parking-spaces.confirmations.index', $space))
        ->assertInertia(fn (Assert $page) => $page
            ->has('confirmations.data', 20)
            ->has('counts.moderation')
            ->where('outcomes', ['total' => 22, 'confirmed' => 21, 'moved' => 0, 'unavailable' => 1]));
});

test('the municipality decides the province and country of an edited parking space', function () {
    $space = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
    $haarlem = Municipality::factory()->create(['name' => 'Haarlem']);

    $this->actingAs($this->admin)->get(route('app.parking-spaces.edit', $space))
        ->assertInertia(fn (Assert $page) => $page
            ->where('municipalities', fn ($municipalities) => collect($municipalities)->contains(fn (array $municipality) => $municipality['id'] === $haarlem->id
                && $municipality['region'] === "{$haarlem->province->name} · {$haarlem->country->name}")));

    $this->put(route('app.parking-spaces.update', $space), [
        'municipality_id' => $haarlem->id,
        'postcode' => '2011 HL',
        'street' => 'Kerkstraat 12',
        'latitude' => 52.381,
        'longitude' => 4.6366,
        'orientation' => 'parallel',
        'under_sign' => 'no',
        'status' => ParkingStatus::APPROVED->value,
    ])->assertSessionHasNoErrors()->assertRedirect(route('app.parking-spaces.show', $space));

    expect($space->fresh())
        ->municipality_id->toBe($haarlem->id)
        ->province_id->toBe($haarlem->province_id)
        ->country_id->toBe($haarlem->country_id);
});
