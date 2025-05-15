<?php

use App\Http\Controllers\Admin;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

// Backend
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::prefix('app')->as('app.')->group(function () {
        // Bulk update route for user parking spots
        Route::patch('user-parking-spots/bulk-update', [Admin\ParkingSpotController::class, 'bulkUpdate'])
            ->name('user-parking-spots.bulk-update');

        // Suspend user route
        Route::put('/users/{user}/suspend', [Admin\UserController::class, 'suspend'])
            ->name('users.suspend')
            ->middleware(['can:user.update']);

        // Keep resource routes at the bottom to avoid conflicts with other routes
        Route::resource('users', Admin\UserController::class);
        Route::resource('roles', Admin\RoleController::class);
        Route::resource('parking-rules', Admin\ParkingRuleController::class);
        Route::resource('user-parking-spots', Admin\ParkingSpotController::class);
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
