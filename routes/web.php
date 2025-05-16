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
        // UserParkingSpot routes
        Route::prefix('user-parking-spots')->as('user-parking-spots.')->group(function () {
            // Delete and restore routes
            Route::get('trash', [Admin\ParkingSpotController::class, 'trash'])->name('trash');

            // Single actions
            Route::patch('{user_parking_spot}/restore', [Admin\ParkingSpotController::class, 'restore'])->name('restore');
            Route::delete('{user_parking_spot}/force', [Admin\ParkingSpotController::class, 'forceDelete'])->name('force-delete');

            // Bulk actions
            Route::patch('bulk-update', [Admin\ParkingSpotController::class, 'bulkUpdate'])->name('bulk-update');
            Route::patch('restore', [Admin\ParkingSpotController::class, 'bulkRestore'])->name('bulk-restore');
            Route::delete('force', [Admin\ParkingSpotController::class, 'bulkForceDelete'])->name('bulk-force-delete');
        });

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
