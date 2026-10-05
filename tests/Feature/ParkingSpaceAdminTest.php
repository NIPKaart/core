<?php

use App\Enums\ParkingStatus;
use App\Enums\UserRole;
use App\Models\ParkingMunicipal;
use App\Models\ParkingPlaceReport;
use App\Models\ParkingSpace;
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
