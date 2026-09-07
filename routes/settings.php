<?php

use App\Http\Controllers\Settings\LocaleController;
use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\ProfileController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware('auth')->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->middleware('throttle:6,1,settings')->name('profile.update');
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->middleware('throttle:6,1,settings')->name('profile.destroy');

    Route::get('settings/password', [PasswordController::class, 'edit'])->middleware('verified')->name('password.edit');

    Route::put('settings/password', [PasswordController::class, 'update'])
        ->middleware(['verified', 'throttle:6,1,settings'])
        ->name('password.update');

    Route::get('settings/appearance', function () {
        return Inertia::render('settings/appearance');
    })->name('appearance.edit');

    Route::patch('settings/locale', [LocaleController::class, 'update'])->name('locale.update');
});
