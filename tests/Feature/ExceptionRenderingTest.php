<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;

test('API errors are JSON even when the client accepts HTML', function (string $path, int $status) {
    Route::get('/api/test-auth', fn () => response()->json([]))->middleware('auth');

    $this->get($path, ['Accept' => 'text/html'])
        ->assertStatus($status)
        ->assertHeader('Content-Type', 'application/json')
        ->assertJsonStructure(['message']);
})->with([
    'missing route' => ['/api/does-not-exist', 404],
    'unauthenticated' => ['/api/test-auth', 401],
    'missing parking space' => ['/api/parking-spaces/00000000-0000-4000-8000-000000000000', 404],
]);

test('API validation exceptions have JSON field errors without an Accept header', function () {
    Route::get('/api/test-validation', function () {
        throw ValidationException::withMessages(['name' => 'A name is required.']);
    });

    $this->get('/api/test-validation')->assertUnprocessable()->assertJsonValidationErrors('name');
});

test('API HTTP exceptions preserve their status and headers', function () {
    Route::get('/api/test-throttle', fn () => abort(429, 'Too many requests.', ['Retry-After' => '60']));

    $this->get('/api/test-throttle')->assertStatus(429)
        ->assertHeader('Retry-After', '60')
        ->assertJsonPath('message', 'Too many requests.');
});

test('web exceptions still follow content negotiation', function () {
    $this->get('/does-not-exist', ['Accept' => 'text/html'])
        ->assertNotFound()->assertHeader('Content-Type', 'text/html; charset=utf-8');

    $this->getJson('/does-not-exist')
        ->assertNotFound()->assertHeader('Content-Type', 'application/json');

    $this->get(route('dashboard'))->assertRedirect(route('login'));
});
