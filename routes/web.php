<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Profile;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Backend routes
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    // Notification routes
    Route::prefix('notifications')->as('notifications.')
        ->controller(NotificationController::class)
        ->group(function () {
            Route::get('/', 'index')->name('index');
            Route::patch('bulk', 'bulk')->name('bulk');
            Route::get('{id}/read', 'read')->name('read');
            Route::get('{id}/unread', 'unread')->name('unread');
            Route::get('read/all', 'readAll')->name('readAll');
            Route::delete('{id}/remove', 'remove')->name('remove');
            Route::get('remove/all', 'removeAll')->name('removeAll');
        });

    // Profile routes
    Route::prefix('profile')->as('profile.')->group(function () {
        // Profile routes
        Route::get('parking-spaces', [Profile\MyParkingSpaceController::class, 'index'])->name('parking-spaces.index');
        Route::get('parking-spaces/{id}', [Profile\MyParkingSpaceController::class, 'show'])->name('parking-spaces.show');
        Route::delete('parking-spaces/{id}', [Profile\MyParkingSpaceController::class, 'destroy'])->name('parking-spaces.destroy');

        // Favorites routes
        Route::get('favorites', [Profile\FavoriteController::class, 'index'])->name('favorites.index');
        Route::get('favorites/list', [Profile\FavoriteController::class, 'list'])->name('favorites.list');
        Route::post('favorites', [Profile\FavoriteController::class, 'store'])->name('favorites.store');
        Route::delete('favorites', [Profile\FavoriteController::class, 'destroy'])->name('favorites.destroy');
    });

    // App routes
    Route::prefix('app')->as('app.')->group(function () {
        // ParkingSpace routes
        Route::prefix('parking-spaces')->as('parking-spaces.')->group(function () {
            // Confirmations routes
            Route::get('{parking_space}/confirmations', [Admin\ParkingSpaceConfirmationController::class, 'index'])->name('confirmations.index');
            Route::delete('{parking_space}/confirmations/{confirmation}', [Admin\ParkingSpaceConfirmationController::class, 'destroy'])->name('confirmations.destroy');
            Route::delete('{parking_space}/confirmations/bulk/delete', [Admin\ParkingSpaceConfirmationController::class, 'bulkDelete'])->name('confirmations.bulk.destroy');

            // Delete and restore routes
            Route::get('trash', [Admin\ParkingSpaceController::class, 'trash'])->name('trash');

            // Single actions
            Route::patch('{parking_space}/restore', [Admin\ParkingSpaceController::class, 'restore'])->whereUuid('parking_space')->name('restore');
            Route::delete('{parking_space}/force-delete', [Admin\ParkingSpaceController::class, 'forceDelete'])->whereUuid('parking_space')->name('force-destroy');

            // Bulk actions
            Route::prefix('bulk')->as('bulk.')->group(function () {
                Route::patch('update', [Admin\ParkingSpaceController::class, 'bulkUpdate'])->name('update');
                Route::patch('restore', [Admin\ParkingSpaceController::class, 'bulkRestore'])->name('restore');
                Route::delete('force-delete', [Admin\ParkingSpaceController::class, 'bulkForceDelete'])->name('force-delete');
            });
        });

        // ParkingOffstreet routes
        Route::prefix('parking-offstreet')->as('parking-offstreet.')->group(function () {
            Route::get('/', [Admin\ParkingOffstreetController::class, 'index'])->name('index');
            Route::post('toggle-visibility', [Admin\ParkingOffstreetController::class, 'toggleVisibility'])->name('toggle-visibility');

            Route::prefix('bulk')->as('bulk.')->group(function () {
                Route::patch('toggle-visibility', [Admin\ParkingOffstreetController::class, 'bulkSetVisibility'])->name('toggle-visibility');
            });
        });

        Route::patch('imports/sources/{dataset_source}', [Admin\DatasetSourceController::class, 'update'])->name('imports.sources.update')->middleware('throttle:20,1');
        Route::resource('imports', Admin\DatasetImportController::class)->only(['index', 'store', 'show', 'update'])->parameters(['imports' => 'dataset_import'])->middlewareFor(['store', 'update'], 'throttle:20,1');

        // ParkingMunicipal routes
        Route::prefix('parking-municipal')->as('parking-municipal.')->group(function () {
            Route::get('/', [Admin\ParkingMunicipalController::class, 'index'])->name('index');
            Route::get('/{municipality}', [Admin\ParkingMunicipalController::class, 'municipality'])->name('municipality');

            // Toggle visibility
            Route::post('toggle-visibility', [Admin\ParkingMunicipalController::class, 'toggleVisibility'])->name('toggle-visibility');

        });

        // Places reported as no longer existing
        Route::prefix('improvements')->as('improvements.')->controller(Admin\ParkingSpaceImprovementController::class)->group(function () {
            Route::get('/', 'index')->name('index');
            Route::get('start', 'start')->name('start');
            Route::post('bulk/reject', 'bulkReject')->name('bulk.reject');
            Route::get('{improvement}', 'show')->whereNumber('improvement')->name('show');
            Route::post('{improvement}/approve', 'approve')->whereNumber('improvement')->name('approve');
            Route::post('{improvement}/reject', 'reject')->whereNumber('improvement')->name('reject');
        });

        Route::prefix('reports')->as('reports.')->controller(Admin\ParkingPlaceReportController::class)->group(function () {
            Route::get('/', 'index')->name('index');
            Route::post('{source}/{id}/keep', 'keep')->whereIn('source', ['community', 'municipal'])->name('keep');
            Route::post('{source}/{id}/remove', 'remove')->whereIn('source', ['community', 'municipal'])->name('remove');
        });

        // Suspend user route
        Route::put('/users/{user}/suspend', [Admin\UserController::class, 'suspend'])
            ->name('users.suspend')
            ->middleware(['can:user.update']);

        // Keep resource routes at the bottom to avoid conflicts with other routes
        Route::resource('users', Admin\UserController::class);
        Route::get('roles', [Admin\RoleController::class, 'index'])->name('roles.index');
        Route::resource('parking-rules', Admin\ParkingRuleController::class);
        Route::resource('parking-spaces', Admin\ParkingSpaceController::class);
    });
});

require __DIR__.'/frontend.php';
require __DIR__.'/settings.php';
