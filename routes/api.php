<?php

use App\Http\Controllers\Api;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// API routes for parking space information
Route::middleware(['throttle:30,1', 'web'])->group(function () {
    Route::get('parking-spaces/{id}', [Api\SpacesInfoController::class, 'ParkingSpaceInfo']);
    Route::get('parking-municipal/{id}', [Api\SpacesInfoController::class, 'ParkingMunicipalInfo']);
    Route::get('parking-offstreet/{id}', [Api\SpacesInfoController::class, 'ParkingOffstreetInfo']);
});

// API route for search functionality
Route::middleware(['throttle:60,1', 'web'])->group(function () {
    Route::get('search', [Api\SearchController::class, 'search']);
});
