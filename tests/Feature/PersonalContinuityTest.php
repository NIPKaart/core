<?php

use App\Enums\ImprovementRejectionReason;
use App\Enums\ParkingStatus;
use App\Enums\ReportResolution;
use App\Models\Favorite;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingPlaceReport;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceImprovement;
use App\Models\User;
use App\Services\UserActivity;
use Inertia\Testing\AssertableInertia as Assert;

test('the personal contribution stream mixes current submissions improvements and reports in a deterministic order', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $this->travelTo('2026-10-01 09:00:00');
    $published = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::APPROVED]);
    $this->travelTo('2026-10-02 09:00:00');
    $proposal = ParkingSpaceImprovement::factory()->for($user)->create(['parking_space_id' => ParkingSpace::factory()->for($other)->create(['status' => ParkingStatus::APPROVED])->id, 'status' => ParkingStatus::REJECTED, 'reason' => ImprovementRejectionReason::INCORRECT, 'reviewed_at' => now()]);
    $this->travelTo('2026-10-03 09:00:00');
    $report = ParkingPlaceReport::factory()->for($user)->municipal()->create(['parking_municipal_id' => ParkingMunicipal::factory()->create(['visibility' => true])->id, 'resolution' => ReportResolution::KEPT, 'resolved_at' => now()]);
    ParkingPlaceReport::factory()->for($other)->municipal()->create();
    ParkingSpaceImprovement::factory()->for($other)->create(['parking_space_id' => ParkingSpace::factory()->for($other)->create(['status' => ParkingStatus::APPROVED])->id]);
    ParkingSpace::factory()->for($other)->create();

    $this->actingAs($user)->get(route('dashboard', ['section' => 'contributions']))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->has('contributions.data', 3)->where('contributions.data.0.key', "report:{$report->id}")
            ->where('contributions.data.0.status', 'kept')->where('contributions.data.0.action', 'map')
            ->where('contributions.data.1.key', "improvement:{$proposal->id}")
            ->where('contributions.data.1.status', 'rejected')->where('contributions.data.1.reason', ImprovementRejectionReason::INCORRECT->label())
            ->where('contributions.data.2.key', "submission:{$published->id}")
            ->where('contributions.data.2.withdraw_id', null)
            ->where('contributions.data.2.url', UserActivity::mapUrl($published))));
});

test('all contribution pages remain reachable and links retain the contributions tab', function () {
    $user = User::factory()->create();
    ParkingSpace::factory()->for($user)->count(17)->create(['status' => ParkingStatus::PENDING]);
    $this->actingAs($user)->get(route('dashboard', ['section' => 'contributions']))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->has('contributions.data', 15)->where('contributions.total', 17)->where('contributions.current_page', 1)
            ->where('contributions.next_page_url', fn (string $url) => str_contains($url, 'section=contributions') && str_contains($url, 'contributions_page=2'))));
    $this->get(route('dashboard', ['section' => 'contributions', 'contributions_page' => 2]))
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->has('contributions.data', 2)->where('contributions.current_page', 2)));
});

test('hidden report targets expose status but no hidden name location or map action', function () {
    $user = User::factory()->create();
    ParkingPlaceReport::factory()->for($user)->municipal()->create([
        'parking_municipal_id' => ParkingMunicipal::factory()->create(['visibility' => false, 'street' => 'Private address'])->id,
        'resolution' => ReportResolution::REMOVED, 'resolved_at' => now(),
    ]);
    $this->actingAs($user)->get(route('dashboard', ['section' => 'contributions']))->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
        ->where('contributions.data.0.status', 'removed')->where('contributions.data.0.label', null)
        ->where('contributions.data.0.url', null)->where('contributions.data.0.action', null)));
});

test('a pending submission opens editing and another account cannot reopen it', function () {
    $user = User::factory()->create();
    $space = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);
    expect(app(UserActivity::class)->contributions($user)->items()[0]['withdraw_id'])->toBe((string) $space->id);
    $this->actingAs($user)->get(route('profile.parking-spaces.show', $space))->assertRedirect(route('location-map.edit', $space));
    $this->actingAs(User::factory()->create())->get(route('profile.parking-spaces.show', $space))->assertForbidden();
});

test('legacy personal lists lead to the matching Mijn NIPKaart section', function () {
    $this->actingAs(User::factory()->create())->get(route('profile.parking-spaces.index'))->assertRedirect(route('dashboard', ['section' => 'contributions']));
    $this->get(route('profile.favorites.index'))->assertRedirect(route('dashboard', ['section' => 'favorites']));
});

test('personal section and pagination inputs are validated', function (array $query, string $field) {
    $this->actingAs(User::factory()->create())->getJson(route('dashboard', $query))->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    [['section' => 'other'], 'section'], [['view' => 'other'], 'view'], [['destination' => 0], 'destination'], [['contributions_page' => 0], 'contributions_page'],
    [['contributions_page' => 10001], 'contributions_page'], [['contributions_page' => 'abc'], 'contributions_page'],
]);

test('favorites are removed on explicit unpublication for all sources and do not revive when restored', function (string $model, array $public, array $hidden) {
    $place = $model::factory()->create($public);
    $favorite = Favorite::factory()->for($place, 'favoritable')->create();
    $other = Favorite::factory()->create();
    $place->forceFill($hidden)->save();
    $this->assertModelMissing($favorite);
    $this->assertModelExists($other);
    $place->forceFill($public)->save();
    expect($favorite->fresh())->toBeNull();
})->with([
    [ParkingSpace::class, ['status' => ParkingStatus::APPROVED], ['status' => ParkingStatus::REJECTED]],
    [ParkingMunicipal::class, ['visibility' => true], ['visibility' => false]],
    [ParkingOffstreet::class, ['visibility' => true], ['visibility' => false]],
]);

test('deleting an imported target removes its favorites while ordinary updates preserve them', function (string $model) {
    $place = $model::factory()->create(['visibility' => true]);
    $favorite = Favorite::factory()->for($place, 'favoritable')->create();
    $place->forceFill(['latitude' => 52.1])->save();
    $this->assertModelExists($favorite);
    $place->delete();
    $this->assertModelMissing($favorite);
})->with([ParkingMunicipal::class, ParkingOffstreet::class]);

test('legacy favorite maintenance only counts by default and needs explicit execution to remove obsolete references', function () {
    $public = Favorite::factory()->for(ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]), 'favoritable')->create();
    $hidden = Favorite::factory()->for(ParkingMunicipal::factory()->create(['visibility' => false]), 'favoritable')->create();
    $orphan = Favorite::factory()->create(['favoritable_type' => (new ParkingOffstreet)->getMorphClass(), 'favoritable_id' => 'missing']);
    $this->artisan('nipkaart:prune-unavailable-favorites')->expectsOutputToContain('Unavailable favorites: 2. No records changed.')->assertSuccessful();
    $this->assertModelExists($hidden);
    $this->assertModelExists($orphan);
    $this->artisan('nipkaart:prune-unavailable-favorites', ['--execute' => true])->expectsOutputToContain('Removed 2 unavailable favorites.')->assertSuccessful();
    $this->assertModelMissing($hidden);
    $this->assertModelMissing($orphan);
    $this->assertModelExists($public);
});
