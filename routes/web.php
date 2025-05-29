<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\User;
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

    // User routes
    Route::prefix('user')->as('user.')->group(function () {
        // Profile routes
        Route::get('parking-spots', [User\MyParkingSpotController::class, 'index'])->name('parking-spots.index');
        Route::get('parking-spots/{id}', [User\MyParkingSpotController::class, 'show'])->name('parking-spots.show');
        Route::delete('parking-spots/{id}', [User\MyParkingSpotController::class, 'destroy'])->name('parking-spots.destroy');

        // Favorites routes
        Route::get('favorites', [User\FavoriteController::class, 'index'])->name('favorites.index');
        Route::get('favorites/list', [User\FavoriteController::class, 'list'])->name('favorites.list');
        Route::post('favorites', [User\FavoriteController::class, 'store'])->name('favorites.store');
        Route::delete('favorites', [User\FavoriteController::class, 'destroy'])->name('favorites.destroy');
    });

    // App routes
    Route::prefix('app')->as('app.')->group(function () {
        // ParkingSpot routes
        Route::prefix('parking-spots')->as('parking-spots.')->group(function () {
            // Confirmations routes
            Route::get('{parkingSpot}/confirmations', [ParkingSpotConfirmationController::class, 'index'])->name('confirmations.index');
            Route::post('{parking_spot}/confirm', [ParkingSpotConfirmationController::class, 'store'])->name('confirm');

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
