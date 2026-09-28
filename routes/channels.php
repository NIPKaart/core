<?php

use App\Models\DatasetImport;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::routes(['middleware' => ['web', 'auth']]);

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Admin pages reload their dataset data live; only users who may see imported data listen.
Broadcast::channel('datasets', function (User $user) {
    return $user->can('viewAny', DatasetImport::class) || $user->can('viewAny', ParkingOffstreet::class) || $user->can('viewAny', ParkingMunicipal::class);
});
