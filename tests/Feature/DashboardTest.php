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

test('a contributor sees their own figures and no work to do', function () {
    $user = User::factory()->create();
    ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::APPROVED]);
    ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);
    $other = User::factory()->create();
    ParkingSpace::factory()->for($other)->create(['status' => ParkingStatus::PENDING]);
    ParkingSpaceConfirmation::factory()->for($user)->for(ParkingSpace::factory()->for($other))->count(2)->create();

    $this->actingAs($user)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('stats', ['added' => 2, 'published' => 1, 'pending' => 1, 'confirmed' => 2])
            ->where('hasTodo', false)
            ->missing('todo')
            ->loadDeferredProps(fn (Assert $reload) => $reload->where('todo', ['moderation' => null, 'queue' => [], 'sources' => ['total' => 0, 'items' => []]])));
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

test('recent activity merges outcomes and own actions, newest first and only the person\'s own', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $this->travelTo('2026-10-01 09:00:00');
    $space = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING, 'street' => 'Lange Voorhout']);
    $this->travelTo('2026-10-02 09:00:00');
    Favorite::factory()->for($user)->for(ParkingSpace::factory()->for($other)->create(['status' => ParkingStatus::APPROVED, 'street' => 'Coolsingel']), 'favoritable')->create();
    notifyAbout($user, 'community.space_status_changed', ['space_label' => 'Lange Voorhout', 'new_status' => 'approved'], '2026-10-03 09:00:00');
    notifyAbout($user, 'dataset.import_ready_for_review', ['source_name' => 'Utrecht'], '2026-10-03 10:00:00');
    ParkingSpace::factory()->for($other)->create(['street' => 'Someone else']);

    $this->actingAs($user)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->has('activity', 3)
            ->where('activity.0.kind', 'community.space_status_changed')
            ->where('activity.0.unread', true)
            ->where('activity.0.params.new_status', 'approved')
            ->where('activity.1.kind', 'saved')
            ->where('activity.1.params.space_label', fn (string $label) => str_starts_with($label, 'Coolsingel'))
            ->where('activity.2.kind', 'added')
            ->where('activity.2.params.status', 'pending')
            ->where('activity.2.url', route('profile.parking-spaces.show', ['id' => $space->id]))));
});

test('favorites open on the map', function () {
    $user = User::factory()->create();
    $place = ParkingSpace::factory()->for(User::factory())->create(['status' => ParkingStatus::APPROVED, 'street' => 'Stationsplein', 'latitude' => 52.5, 'longitude' => 6.09]);
    Favorite::factory()->for($user)->for($place, 'favoritable')->create();

    $this->actingAs($user)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('favorites', 1)
            ->where('favorites.0.title', 'Stationsplein')
            ->where('favorites.0.type', 'Community')
            ->where('favorites.0.map_url', route('location-map', ['place' => "community:{$place->id}", 'at' => '52.50000,6.09000'])));
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

    $this->actingAs($user)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('favorites.0.available', false)
            ->where('favorites.0.title', '')
            ->where('favorites.0.map_url', null)
            ->loadDeferredProps(fn (Assert $reload) => $reload
                ->where('activity.0.kind', 'saved')
                ->where('activity.0.params.space_label', null)
                ->where('activity.0.url', null)));
});

test('only the five newest favorites of the person are listed', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $places = ParkingSpace::factory()->for($other)->count(6)->create(['status' => ParkingStatus::APPROVED]);
    $places->each(function (ParkingSpace $place, int $index) use ($user) {
        $this->travelTo(now()->addMinute());
        Favorite::factory()->for($user)->for($place, 'favoritable')->create();
    });
    Favorite::factory()->for($other)->for($places->first(), 'favoritable')->create();

    $this->actingAs($user)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('favorites', 5)
            ->where('favorites.0.id', $places->last()->id));
});

test('outcomes stay visible behind many operational notifications, and others\' notifications never show', function () {
    $admin = tap(User::factory()->create())->assignRole(UserRole::ADMIN);
    notifyAbout($admin, 'community.improvement_approved', ['space_label' => 'Kerkstraat 8', 'changes' => ['orientation']], '2026-10-01 09:00:00');
    foreach (range(0, 59) as $minute) {
        notifyAbout($admin, 'community.space_submitted', ['space_label' => "Inzending {$minute}"], sprintf('2026-10-02 09:%02d:00', $minute));
    }
    notifyAbout(User::factory()->create(), 'community.improvement_rejected', ['space_label' => 'Elders'], '2026-10-03 09:00:00');

    $this->actingAs($admin)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->has('activity', 1)
            ->where('activity.0.kind', 'community.improvement_approved')
            ->where('activity.0.params.changes', ['orientation'])));
});

test('the dashboard names the person and their role', function () {
    $this->travelTo('2025-03-12 09:00:00');
    $moderator = tap(User::factory()->create(['name' => 'Klaas Schoute']))->assignRole(UserRole::MODERATOR);

    $this->actingAs($moderator)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('profile.name', 'Klaas Schoute')
            ->where('profile.role', UserRole::MODERATOR->label())
            ->where('profile.member_since', '2025-03-12T09:00:00+00:00'));
});

test('a moderator sees the first five items of the queue, each opening its review', function () {
    $moderator = tap(User::factory()->create())->assignRole(UserRole::MODERATOR);
    $spaces = collect(range(1, 6))->map(function (int $day) {
        $this->travelTo("2026-10-0{$day} 09:00:00");

        return ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING, 'street' => "Straat {$day}"]);
    });

    $this->actingAs($moderator)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->has('todo.queue', 5)
            ->where('todo.queue.0.type', 'submission')
            ->where('todo.queue.0.street', 'Straat 1')
            ->where('todo.queue.0.url', route('app.moderation.submissions.show', ['parking_space' => $spaces->first()->id]))));
});

test('the map shows the person\'s own spaces and only the saved places that are still public', function () {
    $user = User::factory()->create();
    $own = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING, 'street' => 'Eigen straat']);
    ParkingSpace::factory()->for(User::factory())->create();
    $public = ParkingSpace::factory()->for(User::factory())->create(['status' => ParkingStatus::APPROVED, 'street' => 'Stationsplein']);
    Favorite::factory()->for($user)->for($public, 'favoritable')->create();
    Favorite::factory()->for($user)->for(ParkingMunicipal::factory()->create(['visibility' => false]), 'favoritable')->create();

    $this->actingAs($user)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->missing('map')
            ->loadDeferredProps(fn (Assert $reload) => $reload
                ->has('map.spaces', 1)
                ->where('map.spaces.0.status', 'pending')
                ->where('map.spaces.0.url', route('profile.parking-spaces.show', ['id' => $own->id]))
                ->has('map.favorites', 1)
                ->where('map.favorites.0.label', 'Stationsplein')));
});

test('people with moderation work get no map, so it is not loaded for them', function () {
    $moderator = tap(User::factory()->create())->assignRole(UserRole::MODERATOR);

    $this->actingAs($moderator)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload->missing('map')));
});
