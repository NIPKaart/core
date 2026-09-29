<?php

use App\Http\Controllers\Frontend;

// Home
Route::get('/', [Frontend\HomeController::class, 'index'])->name('home');

// Map
Route::get('map', [Frontend\ParkingSpaceController::class, 'map'])->name('location-map');

// Contributing a community parking place
Route::prefix('map/add')->as('location-map.')->middleware('community')->controller(Frontend\ParkingContributionController::class)->group(function () {
    Route::get('/', 'create')->name('add');
    Route::post('/', 'store')->name('store');
    Route::get('locate', 'locate')->middleware('throttle:60,1,parking-locate')->name('locate');
    Route::get('{parking_space}/submitted', 'submitted')->whereUuid('parking_space')->name('submitted');
    Route::get('{parking_space}/edit', 'edit')->whereUuid('parking_space')->name('edit');
    Route::put('{parking_space}', 'update')->whereUuid('parking_space')->name('update');
});

// Confirming that a published community or municipal parking place exists
Route::post('map/places/{source}/{id}/confirm', [Frontend\ParkingConfirmationController::class, 'store'])
    ->whereIn('source', ['community', 'municipal'])
    ->middleware(['community', 'throttle:30,1,parking-confirm'])
    ->name('map.places.confirm');

// First-party browser JSON endpoints
Route::prefix('map')->as('map.')->group(function () {
    Route::get('parking-spaces/{id}', [Frontend\SpacesInfoController::class, 'ParkingSpaceInfo'])->name('parking-spaces.show');
    Route::get('parking-municipal/{id}', [Frontend\SpacesInfoController::class, 'ParkingMunicipalInfo'])->name('parking-municipal.show');
    Route::get('parking-offstreet/{id}', [Frontend\SpacesInfoController::class, 'ParkingOffstreetInfo'])->name('parking-offstreet.show');
});

Route::prefix('map/parking')->as('map.parking.')->middleware('throttle:parking-discovery')->group(function () {
    Route::get('nearby', [Frontend\ParkingDiscoveryController::class, 'nearby'])->name('nearby');
    Route::get('viewport', [Frontend\ParkingDiscoveryController::class, 'viewport'])->name('viewport');
    Route::get('garage-occupancy', [Frontend\ParkingDiscoveryController::class, 'garageOccupancy'])->name('garage-occupancy');
});

// Map records are loaded once per area and clustered in the browser, so responses are browser-cacheable.
Route::prefix('map/parking')->as('map.parking.')->middleware(['throttle:parking-discovery', 'cache.headers:public;max_age=60;etag'])->group(function () {
    Route::get('areas', [Frontend\ParkingDiscoveryController::class, 'areas'])->name('areas');
    Route::get('area/{x}/{y}', [Frontend\ParkingDiscoveryController::class, 'area'])->whereNumber(['x', 'y'])->name('area');
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
Route::post('contact', [Frontend\ContactController::class, 'store'])->middleware('throttle:5,10,contact')->name('contact.store');
