<?php

use App\Enums\ApiState;
use App\Enums\ParkingStatus;
use App\Enums\RuleLinkStatus;
use App\Enums\UserRole;
use App\Models\Destination;
use App\Models\Favorite;
use App\Models\Municipality;
use App\Models\ParkingOffstreet;
use App\Models\ParkingRule;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceReview;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('a destination shows the public parking within walking distance, nearest first', function () {
    $user = User::factory()->create();
    $work = Destination::factory()->for($user)->create(['label' => 'Werk', 'latitude' => 52.0894, 'longitude' => 5.1101]);
    Destination::factory()->for($user)->create(['label' => 'Zus', 'latitude' => 52.3600, 'longitude' => 4.8800]);
    $near = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'street' => 'Dichtbij', 'latitude' => 52.0895, 'longitude' => 5.1102, 'parking_time' => 180]);
    ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'street' => 'Iets verder', 'latitude' => 52.0910, 'longitude' => 5.1101]);
    ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING, 'latitude' => 52.0894, 'longitude' => 5.1101]);
    ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'latitude' => 52.1000, 'longitude' => 5.1101]);

    $this->actingAs($user)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('view', 'personal')->loadDeferredProps(fn (Assert $reload) => $reload
            ->has('overview.destinations', 2)
            ->where('overview.destination_id', $work->id)
            ->where('overview.nearby.total', 2)
            ->where('overview.nearby.more', false)
            ->where('overview.nearby.items.0.key', "community:{$near->id}")
            ->where('overview.nearby.items.0.parking_time', 180)
            ->where('overview.nearby.items.1.title', 'Iets verder')));
});

test('choosing another destination shows the parking around that one', function () {
    $user = User::factory()->create();
    Destination::factory()->for($user)->create(['label' => 'A werk', 'latitude' => 52.0894, 'longitude' => 5.1101]);
    $other = Destination::factory()->for($user)->create(['label' => 'B zus', 'latitude' => 52.3600, 'longitude' => 4.8800]);
    ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'street' => 'Bij zus', 'latitude' => 52.3601, 'longitude' => 4.8801]);
    $foreign = Destination::factory()->create();

    $this->actingAs($user)->get(route('dashboard', ['destination' => $other->id]))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('overview.destination_id', $other->id)->where('overview.nearby.items.0.title', 'Bij zus')));
    $this->get(route('dashboard', ['destination' => $foreign->id]))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('overview.destination_id', fn (int $id) => $id !== $foreign->id)));
});

test('a saved garage shows live occupancy only for a current measurement', function (array $state, ?int $free) {
    $user = User::factory()->create();
    $garage = ParkingOffstreet::factory()->create(['visibility' => true, 'name' => 'P+R Science Park', 'capacity' => 600, 'free_space' => 142, 'occupancy_status' => 'counting', ...$state]);
    Favorite::factory()->for($user)->for($garage, 'favoritable')->create();

    $this->actingAs($user)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('overview.garage.name', 'P+R Science Park')
            ->where('overview.garage.free_space', $free)
            ->where('overview.favorites.items.0.source', 'offstreet')));
})->with([
    'current' => [['api_state' => ApiState::OK, 'observed_at' => now()], 142],
    'stale' => [['api_state' => ApiState::OK, 'observed_at' => now()->subDays(2)], null],
    'failing feed' => [['api_state' => ApiState::ERROR, 'observed_at' => now()], null],
]);

test('own contributions show the waiting submission and how many are on the map', function () {
    $user = User::factory()->create();
    ParkingSpace::factory()->for($user)->count(2)->create(['status' => ParkingStatus::APPROVED]);
    ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::REJECTED]);
    $pending = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING, 'street' => 'Lange Nieuwstraat']);
    ParkingSpace::factory()->for(User::factory())->create(['status' => ParkingStatus::APPROVED]);

    $this->actingAs($user)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('overview.published', 2)
            ->where('overview.pending.label', fn (string $label) => str_starts_with($label, 'Lange Nieuwstraat'))
            ->where('overview.pending.edit_url', route('location-map.edit', ['parking_space' => $pending->id]))
            ->where('overview.pending.withdraw_id', (string) $pending->id)
            ->has('overview.history', 3)
            ->where('overview.history', fn ($history) => collect($history)->pluck('status')->sort()->values()->all() === ['approved', 'approved', 'rejected'])));
});

test('favorites carry their parking conditions and the official rules where they lie', function () {
    $user = User::factory()->create();
    $utrecht = Municipality::factory()->create(['name' => 'Utrecht']);
    $houten = Municipality::factory()->create(['name' => 'Houten']);
    $rule = ParkingRule::factory()->for($utrecht)->create(['country_id' => $utrecht->country_id, 'link_status' => RuleLinkStatus::OK]);
    ParkingRule::factory()->for($houten)->create(['country_id' => $houten->country_id, 'link_status' => RuleLinkStatus::BROKEN]);
    $space = ParkingSpace::factory()->for($utrecht)->create([
        'status' => ParkingStatus::APPROVED, 'country_id' => $utrecht->country_id, 'parking_time' => 120,
        'restriction_days' => ['mon', 'fri'], 'restriction_starts_at' => '09:00', 'restriction_ends_at' => '18:00',
    ]);
    Favorite::factory()->for($user)->for($space, 'favoritable')->create();
    Favorite::factory()->for($user)->for(ParkingSpace::factory()->for($houten)->create(['status' => ParkingStatus::APPROVED, 'country_id' => $houten->country_id]), 'favoritable')->create();

    $this->actingAs($user)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('overview.favorites.total', 2)
            ->where('overview.favorites.items.1.parking_time', 120)
            ->where('overview.favorites.items.1.restriction_days', ['mon', 'fri'])
            ->has('overview.rules', 1)
            ->where('overview.rules.0.id', $rule->id)
            ->where('overview.rules.0.name', 'Utrecht')));
});

test('a moderator sees their own decisions of this week', function () {
    $this->travelTo('2026-10-14 12:00:00');
    $moderator = tap(User::factory()->create())->assignRole(UserRole::MODERATOR);
    ParkingSpaceReview::factory()->count(2)->create(['reviewed_by' => $moderator->id, 'to_status' => ParkingStatus::APPROVED]);
    ParkingSpaceReview::factory()->create(['reviewed_by' => $moderator->id, 'to_status' => ParkingStatus::REJECTED]);
    ParkingSpaceReview::factory()->create(['reviewed_by' => $moderator->id, 'reviewed_at' => '2026-10-09 12:00:00']);
    ParkingSpaceReview::factory()->create();

    $this->actingAs($moderator)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('todo.decisions', ['total' => 3, 'approved' => 2, 'rejected' => 1, 'reports' => 0])));
});

test('administrators see broken parking rule links, moderators do not', function () {
    $this->travelTo('2026-10-14 12:00:00');
    ParkingRule::factory()->create(['link_status' => RuleLinkStatus::BROKEN, 'link_failing_since' => '2026-10-11 03:00:00']);
    ParkingRule::factory()->create(['link_status' => RuleLinkStatus::OK]);
    $admin = tap(User::factory()->create())->assignRole(UserRole::ADMIN);
    $moderator = tap(User::factory()->create())->assignRole(UserRole::MODERATOR);

    $this->actingAs($admin)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('todo.rules.total', 1)->where('todo.rules.items.0.failing_since', '2026-10-11T03:00:00+00:00')));
    $this->actingAs($moderator)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('todo.rules', ['total' => 0, 'items' => []])));
});
