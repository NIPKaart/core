<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\LocationController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Frontend
Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');
// Map
Route::get('map', [LocationController::class, 'map'])->name('map');
Route::get('map/add', [LocationController::class, 'locationAdd'])->name('map.add');
Route::post('map/add', [LocationController::class, 'store'])->name('map.store');

// Backend
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::prefix('app')->as('app.')->group(function () {
        // ParkingSpot routes
        Route::prefix('parking-spots')->as('parking-spots.')->group(function () {
            // Delete and restore routes
            Route::get('trash', [Admin\ParkingSpotController::class, 'trash'])->name('trash');

            // Single actions
            Route::patch('{parking_spot}/restore', [Admin\ParkingSpotController::class, 'restore'])->name('restore');
            Route::delete('{parking_spot}/force', [Admin\ParkingSpotController::class, 'forceDelete'])->name('force-delete');

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
        Route::resource('parking-spots', Admin\ParkingSpotController::class);
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
