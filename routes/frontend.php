<?php

use App\Http\Controllers\Frontend;

// Home
Route::get('/', [Frontend\HomeController::class, 'index'])->name('home');

// Map
Route::get('map', [Frontend\ParkingSpaceController::class, 'map'])->name('location-map');
Route::get('map/add', [Frontend\ParkingSpaceController::class, 'locationAdd'])->name('location-map.add');
Route::post('map/add', [Frontend\ParkingSpaceController::class, 'store'])->name('location-map.store');

// Other frontend routes
Route::get('garages', [Frontend\GarageController::class, 'index'])->name('garages');
Route::get('about', [Frontend\AboutController::class, 'index'])->name('about');
Route::get('contact', [Frontend\ContactController::class, 'index'])->name('contact');