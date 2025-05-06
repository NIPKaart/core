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
        Route::resource('users', Admin\UserController::class);
        Route::resource('roles', Admin\RoleController::class);

        // This route is used to suspend a user
        Route::put('/users/{user}/suspend', [Admin\UserController::class, 'suspend'])
            ->name('users.suspend')
            ->middleware(['can:user.update']);
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
