<?php

test('management links use the admin prefix and require authentication', function (string $name, string $path) {
    expect(route($name, [], false))->toBe($path);

    $this->get($path)->assertRedirect(route('login'));
})->with([
    'imports' => ['app.imports.index', '/admin/imports'],
    'moderation' => ['app.moderation.index', '/admin/moderation'],
    'users' => ['app.users.index', '/admin/users'],
    'roles' => ['app.roles.index', '/admin/roles'],
]);

test('personal links remain outside the admin prefix', function (string $name, string $path) {
    expect(route($name, [], false))->toBe($path);

    $this->get($path)->assertRedirect(route('login'));
})->with([
    'dashboard' => ['dashboard', '/dashboard'],
    'parking spaces' => ['profile.parking-spaces.index', '/profile/parking-spaces'],
    'destinations' => ['profile.destinations.index', '/profile/destinations'],
    'favorites' => ['profile.favorites.index', '/profile/favorites'],
]);
