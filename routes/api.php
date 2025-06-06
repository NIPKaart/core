<?php

use App\Http\Controllers\Api;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// API routes for parking space information
Route::middleware(['throttle:30,1', 'web'])->group(function () {
    Route::get('parking-spaces', [Api\SpacesInfoController::class, 'ParkingSpaces']);
    Route::get('parking-municipal', [Api\SpacesInfoController::class, 'ParkingMunicipal']);
});