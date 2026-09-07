<?php

use App\Models\User;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->notificationUser = User::factory()->create();
    foreach (['community.submitted', 'community.deleted', 'system.notice', 'community_extra.notice', 'literal[cat].notice', null] as $type) {
        $this->notificationUser->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'notification',
            'data' => ['type' => $type],
            'read_at' => $type === 'community.deleted' ? now() : null,
        ]);
    }
    User::factory()->create()->notifications()->create([
        'id' => (string) Str::uuid(),
        'type' => 'notification',
        'data' => ['type' => 'private.notice'],
    ]);
});

it('filters exact notification types and read state', function () {
    $this->actingAs($this->notificationUser)
        ->get(route('notifications.index', ['type' => 'community.deleted', 'read' => 'read']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('notificationList.data', 1)
            ->where('notificationList.data.0.type', 'community.deleted'));
});

it('combines literal category prefixes and exact types within the current user', function () {
    $this->actingAs($this->notificationUser)
        ->get(route('notifications.index', ['type' => 'community.*,system.notice', 'read' => 'unread']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('notificationList.data', 2)
            ->where('notificationList.data', fn ($rows) => collect($rows)->pluck('type')->sort()->values()->all() === ['community.submitted', 'system.notice']));
});

it('does not interpret category characters as a regular expression', function () {
    $this->actingAs($this->notificationUser)
        ->get(route('notifications.index', ['type' => 'literal[cat].*']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('notificationList.data', 1)
            ->where('notificationList.data.0.type', 'literal[cat].notice'));
});

it('groups type options and excludes null types and other users', function () {
    $this->actingAs($this->notificationUser)
        ->get(route('notifications.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('notificationList.data', 6)
            ->where('options.types', fn ($options) => collect($options)->values()->sort()->values()->all() === [
                'community.*', 'community_extra.notice', 'literal[cat].notice', 'system.notice',
            ]));
});
