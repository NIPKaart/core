<?php

use App\Enums\ParkingStatus;
use App\Enums\UserRole;
use App\Models\DatasetSource;
use App\Models\Favorite;
use App\Models\ParkingMunicipal;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceConfirmation;
use App\Models\User;
use App\Notifications\CommunitySpace\StatusChanged;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

function notifyAbout(User $user, string $type, array $params, string $at): void
{
    $user->notifications()->create([
        'id' => (string) Str::uuid(),
        'type' => StatusChanged::class,
        'data' => ['type' => $type, 'params' => $params, 'url' => 'https://example.test/'.$type],
        'created_at' => $at,
    ]);
}

test('guests are redirected to the login page', function () {
    $this->get(route('dashboard'))->assertRedirect(route('login'));
});

test('a contributor sees personal continuity without figures or work to do', function () {
    $user = User::factory()->create();
    ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::APPROVED]);
    ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);
    $other = User::factory()->create();
    ParkingSpace::factory()->for($other)->create(['status' => ParkingStatus::PENDING]);
    ParkingSpaceConfirmation::factory()->for($user)->for(ParkingSpace::factory()->for($other))->count(2)->create();

    $this->actingAs($user)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->missing('stats')->missing('map')->missing('activity')
            ->where('hasTodo', false)->where('view', 'personal')
            ->missing('todo')
            ->loadDeferredProps(fn (Assert $reload) => $reload->where('todo', [
                'moderation' => null, 'next' => null, 'decisions' => null,
                'sources' => ['total' => 0, 'items' => []], 'rules' => ['total' => 0, 'items' => []], 'attention' => false,
            ])));
});

test('a moderator is pointed to the moderation queue', function () {
    $moderator = tap(User::factory()->create())->assignRole(UserRole::MODERATOR);
    $this->travelTo('2026-10-01 09:00:00');
    ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING]);
    $this->travelTo('2026-10-04 09:00:00');
    ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING]);

    $this->actingAs($moderator)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('todo.moderation.total', 2)
            ->where('todo.moderation.high', 0)
            ->where('todo.moderation.types', ['submission' => 2])
            ->where('todo.moderation.oldest', '2026-10-01T09:00:00+00:00')
            ->where('todo.sources.total', 0)));
});

test('contributions exclude saved favorites and duplicate notification outcomes', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $this->travelTo('2026-10-01 09:00:00');
    $space = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING, 'street' => 'Lange Voorhout']);
    $this->travelTo('2026-10-02 09:00:00');
    Favorite::factory()->for($user)->for(ParkingSpace::factory()->for($other)->create(['status' => ParkingStatus::APPROVED, 'street' => 'Coolsingel']), 'favoritable')->create();
    notifyAbout($user, 'community.space_status_changed', ['space_label' => 'Lange Voorhout', 'new_status' => 'approved'], '2026-10-03 09:00:00');
    notifyAbout($user, 'dataset.import_ready_for_review', ['source_name' => 'Utrecht'], '2026-10-03 10:00:00');
    ParkingSpace::factory()->for($other)->create(['street' => 'Someone else']);

    $this->actingAs($user)->get(route('profile.parking-spaces.index'))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->has('contributions.data', 1)
            ->where('contributions.data.0.kind', 'submission')
            ->where('contributions.data.0.status', 'pending')
            ->where('contributions.data.0.url', route('location-map.edit', ['parking_space' => $space->id]))));

});

test('favorites open on the map', function () {
    $user = User::factory()->create();
    $place = ParkingSpace::factory()->for(User::factory())->create(['status' => ParkingStatus::APPROVED, 'street' => 'Stationsplein', 'latitude' => 52.5, 'longitude' => 6.09]);
    Favorite::factory()->for($user)->for($place, 'favoritable')->create();

    $this->actingAs($user)->get(route('profile.favorites.index'))->assertInertia(fn (Assert $page) => $page->where('section', 'favorites'));
    $this->getJson(route('profile.favorites.list'))->assertOk()
        ->assertJsonPath('favorites.0.title', 'Stationsplein')->assertJsonPath('favorites.0.type', 'Community')
        ->assertJsonPath('favorites.0.latitude', 52.5)->assertJsonPath('favorites.0.longitude', 6.09);

});

test('an empty queue still tells a moderator there is nothing to review', function () {
    $moderator = tap(User::factory()->create())->assignRole(UserRole::MODERATOR);

    $this->actingAs($moderator)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('hasTodo', true)
            ->loadDeferredProps(fn (Assert $reload) => $reload->where('todo.moderation', ['total' => 0, 'high' => 0, 'types' => [], 'oldest' => null])));
});

test('administrators see the data sources that need attention, moderators do not', function () {
    DatasetSource::factory()->create(['name' => 'Gemeente Utrecht', 'approval_state' => 'pending']);
    $admin = tap(User::factory()->create())->assignRole(UserRole::ADMIN);
    $moderator = tap(User::factory()->create())->assignRole(UserRole::MODERATOR);

    $this->actingAs($admin)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('todo.sources.total', 1)
            ->where('todo.sources.items.0.name', 'Gemeente Utrecht')
            ->where('todo.sources.items.0.status', 'awaiting_approval')
            ->where('todo.sources.items.0.import_id', null)));
    $this->actingAs($moderator)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('todo.sources', ['total' => 0, 'items' => []])));
});

test('a saved place the map no longer shows is not named or located', function () {
    $user = User::factory()->create();
    $hidden = ParkingMunicipal::factory()->create(['visibility' => false, 'street' => 'Verborgen 1']);
    Favorite::factory()->for($user)->for($hidden, 'favoritable')->create();

    $this->actingAs($user)->getJson(route('profile.favorites.list'))->assertOk()->assertJsonCount(0, 'favorites');

});

test('all favorites of the person remain reachable', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $places = ParkingSpace::factory()->for($other)->count(6)->create(['status' => ParkingStatus::APPROVED]);
    $places->each(function (ParkingSpace $place, int $index) use ($user) {
        $this->travelTo(now()->addMinute());
        Favorite::factory()->for($user)->for($place, 'favoritable')->create();
    });
    Favorite::factory()->for($other)->for($places->first(), 'favoritable')->create();

    $this->actingAs($user)->getJson(route('profile.favorites.list'))->assertOk()->assertJsonCount(6, 'favorites');

});

test('notifications stay in the existing inbox without a second inbox on the dashboard', function () {
    $admin = tap(User::factory()->create())->assignRole(UserRole::ADMIN);
    notifyAbout($admin, 'community.improvement_approved', ['space_label' => 'Kerkstraat 8', 'changes' => ['orientation']], '2026-10-01 09:00:00');
    foreach (range(0, 59) as $minute) {
        notifyAbout($admin, 'community.space_submitted', ['space_label' => "Inzending {$minute}"], sprintf('2026-10-02 09:%02d:00', $minute));
    }
    notifyAbout(User::factory()->create(), 'community.improvement_rejected', ['space_label' => 'Elders'], '2026-10-03 09:00:00');

    $this->actingAs($admin)->get(route('profile.parking-spaces.index'))
        ->assertInertia(fn (Assert $page) => $page->missing('activity')->loadDeferredProps(fn (Assert $reload) => $reload
            ->has('contributions.data', 0)));
    expect($admin->notifications()->count())->toBe(61);

});

test('the dashboard names the person and their role', function () {
    $this->travelTo('2025-03-12 09:00:00');
    $moderator = tap(User::factory()->create(['name' => 'Klaas Schoute']))->assignRole(UserRole::MODERATOR);

    $this->actingAs($moderator)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.name', 'Klaas Schoute')->where('auth.roles.0', 'moderator')->missing('profile')->missing('stats'));

});

test('a moderator lands on the workplace with the first queue item opening its review', function () {
    $moderator = tap(User::factory()->create())->assignRole(UserRole::MODERATOR);
    $spaces = collect(range(1, 3))->map(function (int $day) {
        $this->travelTo("2026-10-0{$day} 09:00:00");

        return ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING, 'street' => "Straat {$day}"]);
    });

    $this->actingAs($moderator)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('view', 'work')->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('todo.next.type', 'submission')
            ->where('todo.next.street', 'Straat 1')
            ->where('todo.next.url', route('app.moderation.submissions.show', ['parking_space' => $spaces->first()->id]))));
    $this->get(route('dashboard', ['view' => 'personal']))->assertInertia(fn (Assert $page) => $page->where('view', 'personal'));
});

test('own pending contributions link directly to their editable form', function () {
    $user = User::factory()->create();
    $own = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING, 'street' => 'Eigen straat']);
    ParkingSpace::factory()->for(User::factory())->create();
    $public = ParkingSpace::factory()->for(User::factory())->create(['status' => ParkingStatus::APPROVED, 'street' => 'Stationsplein']);
    Favorite::factory()->for($user)->for($public, 'favoritable')->create();
    Favorite::factory()->for($user)->for(ParkingMunicipal::factory()->create(['visibility' => false]), 'favoritable')->create();

    $this->actingAs($user)->get(route('profile.parking-spaces.index'))
        ->assertInertia(fn (Assert $page) => $page->missing('map')->loadDeferredProps(fn (Assert $reload) => $reload
            ->has('contributions.data', 1)->where('contributions.data.0.status', 'pending')
            ->where('contributions.data.0.url', route('location-map.edit', ['parking_space' => $own->id]))));

});

test('people with moderation work get no map, so it is not loaded for them', function () {
    $moderator = tap(User::factory()->create())->assignRole(UserRole::MODERATOR);

    $this->actingAs($moderator)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload->missing('map')));
});
