<?php

use App\Http\Controllers\Frontend;

// Home
Route::get('/', [Frontend\HomeController::class, 'index'])->name('home');

// Map
Route::prefix('map')->controller(Frontend\ParkingSpaceController::class)->group(function () {
    Route::get('/', 'map')->name('location-map');
    Route::get('add', 'locationAdd')->name('location-map.add');
    Route::post('add', 'store')->name('location-map.store');
});

// Other frontend routes
Route::get('garages', [Frontend\GarageController::class, 'index'])->name('garages');
Route::get('about', [Frontend\AboutController::class, 'index'])->name('about');
Route::get('contact', [Frontend\ContactController::class, 'index'])->name('contact');
