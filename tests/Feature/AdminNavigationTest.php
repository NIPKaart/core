<?php

use App\Enums\ParkingStatus;
use App\Enums\UserRole;
use App\Models\ParkingSpace;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('the navigation shares only counts that ask for action', function () {
    $moderator = tap(User::factory()->create())->assignRole(UserRole::MODERATOR);
    ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING]);
    ParkingSpace::factory()->count(2)->create(['status' => ParkingStatus::APPROVED]);

    $this->actingAs($moderator)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('counts', ['moderation' => ['open' => 1], 'dataSources' => ['attention' => 0]]));
});

test('the trash is a view of the community list for those who may restore', function () {
    $admin = tap(User::factory()->create())->assignRole(UserRole::ADMIN);
    ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
    ParkingSpace::factory()->count(2)->create(['status' => ParkingStatus::APPROVED])->each->delete();

    $this->actingAs($admin);
    $this->get(route('app.parking-spaces.index'))
        ->assertInertia(fn (Assert $page) => $page->component('backend/parking-spaces/index')->where('tabCounts.trash', 2)->has('counts.moderation'));
    $this->get(route('app.parking-spaces.trash'))
        ->assertInertia(fn (Assert $page) => $page->component('backend/parking-spaces/trash/index')->where('tabCounts.trash', 2)->has('counts.moderation'));
});
