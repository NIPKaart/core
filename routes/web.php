<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\ParkingSpaceConfirmationController;
use App\Http\Controllers\ParkingSpaceController;
use App\Http\Controllers\User;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Frontend
Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');
// Map
Route::get('map', [ParkingSpaceController::class, 'map'])->name('map');
Route::get('map/add', [ParkingSpaceController::class, 'locationAdd'])->name('map.add');
Route::post('map/add', [ParkingSpaceController::class, 'store'])->name('map.store');

// Backend
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    // User routes
    Route::prefix('user')->as('user.')->group(function () {
        // Profile routes
        Route::get('parking-spaces', [User\MyParkingSpaceController::class, 'index'])->name('parking-spaces.index');
        Route::get('parking-spaces/{id}', [User\MyParkingSpaceController::class, 'show'])->name('parking-spaces.show');
        Route::delete('parking-spaces/{id}', [User\MyParkingSpaceController::class, 'destroy'])->name('parking-spaces.destroy');

        // Favorites routes
        Route::get('favorites', [User\FavoriteController::class, 'index'])->name('favorites.index');
        Route::get('favorites/list', [User\FavoriteController::class, 'list'])->name('favorites.list');
        Route::post('favorites', [User\FavoriteController::class, 'store'])->name('favorites.store');
        Route::delete('favorites', [User\FavoriteController::class, 'destroy'])->name('favorites.destroy');
    });

    // App routes
    Route::prefix('app')->as('app.')->group(function () {
        // ParkingSpace routes
        Route::prefix('parking-spaces')->as('parking-spaces.')->group(function () {
            // Confirmations routes
            Route::post('{parking_space}/confirm', [ParkingSpaceConfirmationController::class, 'store'])->name('confirm');
            Route::get('{parking_space}/confirmations', [ParkingSpaceConfirmationController::class, 'index'])->name('confirmations.index');
            Route::delete('{parking_space}/confirmations/{confirmation}', [ParkingSpaceConfirmationController::class, 'destroy'])->name('confirmations.destroy');
            Route::delete('{parking_space}/confirmations/bulk/delete', [ParkingSpaceConfirmationController::class, 'bulkDelete'])->name('confirmations.bulk.destroy');

            // Delete and restore routes
            Route::get('trash', [Admin\ParkingSpaceController::class, 'trash'])->name('trash');

            // Single actions
            Route::patch('{parking_space}/restore', [Admin\ParkingSpaceController::class, 'restore'])->name('restore');
            Route::delete('{parking_space}/force-delete', [Admin\ParkingSpaceController::class, 'forceDelete'])->name('force-destroy');

            // Bulk actions
            Route::prefix('bulk')->as('bulk.')->group(function () {
                Route::patch('update', [Admin\ParkingSpaceController::class, 'bulkUpdate'])->name('update');
                Route::patch('restore', [Admin\ParkingSpaceController::class, 'bulkRestore'])->name('restore');
                Route::delete('force-delete', [Admin\ParkingSpaceController::class, 'bulkForceDelete'])->name('force-delete');
            });
        });

        // ParkingMunicipal routes
        Route::prefix('parking-municipal')->as('parking-municipal.')->group(function () {
            Route::get('municipalities', [Admin\ParkingMunicipalController::class, 'municipalities'])->name('municipalities');
            Route::get('municipalities/{municipality}', [Admin\ParkingMunicipalController::class, 'index'])->name('municipalities.index');

            // Toggle visibility
            Route::post('toggle-visibility', [Admin\ParkingMunicipalController::class, 'toggleVisibility'])->name('toggle-visibility');

            // Single actions
            Route::patch('{parking_municipal}/restore', [Admin\ParkingMunicipalController::class, 'restore'])->name('restore');
        });

        // Suspend user route
        Route::put('/users/{user}/suspend', [Admin\UserController::class, 'suspend'])
            ->name('users.suspend')
            ->middleware(['can:user.update']);

        // Keep resource routes at the bottom to avoid conflicts with other routes
        Route::resource('users', Admin\UserController::class);
        Route::resource('roles', Admin\RoleController::class);
        Route::resource('parking-rules', Admin\ParkingRuleController::class);
        Route::resource('parking-spaces', Admin\ParkingSpaceController::class);
        // Route::resource('parking-municipal', Admin\ParkingMunicipalController::class);
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
