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

// First-party browser JSON endpoints
Route::prefix('map')->as('map.')->group(function () {
    Route::get('parking-spaces/{id}', [Frontend\SpacesInfoController::class, 'ParkingSpaceInfo'])->name('parking-spaces.show');
    Route::get('parking-municipal/{id}', [Frontend\SpacesInfoController::class, 'ParkingMunicipalInfo'])->name('parking-municipal.show');
    Route::get('parking-offstreet/{id}', [Frontend\SpacesInfoController::class, 'ParkingOffstreetInfo'])->name('parking-offstreet.show');
});

Route::prefix('map/parking')->as('map.parking.')->middleware('throttle:parking-discovery')->group(function () {
    Route::get('nearby', [Frontend\ParkingDiscoveryController::class, 'nearby'])->name('nearby');
    Route::get('viewport', [Frontend\ParkingDiscoveryController::class, 'viewport'])->name('viewport');
});

// Destination lookups share a separate budget because they can call external geocoders.
Route::prefix('destinations')->as('destinations.')->middleware('throttle:60,1,destinations')->group(function () {
    Route::get('suggestions', [Frontend\DestinationSearchController::class, 'suggestions'])->name('suggestions');
    Route::get('resolve', [Frontend\DestinationSearchController::class, 'resolve'])->name('resolve');
});

// Other frontend routes
Route::get('garages', [Frontend\GarageController::class, 'index'])->name('garages');
Route::get('about', [Frontend\AboutController::class, 'index'])->name('about');
Route::get('contact', [Frontend\ContactController::class, 'index'])->name('contact');
