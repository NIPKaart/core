<?php

use App\Http\Controllers\Api;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::middleware(['throttle:30,1', 'web'])
    ->get('parking-spaces/{id}', [Api\LocationInfoController::class, 'getLocationInfo']);
