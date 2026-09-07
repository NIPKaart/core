<?php

use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingRule;
use App\Models\ParkingSpace;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

it('runs on PostgreSQL with PostGIS and explicit longitude latitude coordinates', function () {
    expect(DB::connection()->getDriverName())->toBe('pgsql');

    $point = DB::selectOne('SELECT ST_SRID(p::geometry) AS srid, ST_X(p::geometry) AS longitude, ST_Y(p::geometry) AS latitude FROM (SELECT ST_SetSRID(ST_MakePoint(4.9, 52.37), 4326)::geography AS p) AS location');

    expect($point->srid)->toBe(4326)
        ->and((float) $point->longitude)->toBe(4.9)
        ->and((float) $point->latitude)->toBe(52.37);
});

it('stores and resolves favorites without coercing parking identifiers', function (string $model, string $type) {
    $user = User::factory()->create();
    $space = $model::factory()->create();

    $this->actingAs($user)->post(route('profile.favorites.store'), [
        'type' => $type,
        'id' => $space->id,
    ])->assertRedirect();

    $favorite = $user->favorites()->with('favoritable')->sole();
    expect($favorite->favoritable_id)->toBe($space->id)
        ->and($favorite->favoritable->is($space))->toBeTrue()
        ->and($space->municipality->province_id)->toBe($space->province_id)
        ->and($space->municipality->country_id)->toBe($space->country_id);
})->with([
    [ParkingSpace::class, 'parking_space'],
    [ParkingMunicipal::class, 'parking_municipal'],
    [ParkingOffstreet::class, 'parking_offstreet'],
]);

it('creates parking rules with a valid municipality relationship', function () {
    $rule = ParkingRule::factory()->create();

    expect($rule->municipality->country_id)->toBe($rule->country_id);
});

it('enforces and cascades the UUID confirmation relationship', function () {
    $space = ParkingSpace::factory()->create();
    $confirmation = $space->confirmations()->create([
        'user_id' => $space->user_id,
        'confirmed_at' => now(),
    ]);

    DB::table('parking_spaces')->where('id', $space->id)->delete();

    $this->assertDatabaseMissing('parking_space_confirmations', ['id' => $confirmation->id]);
});

it('rejects confirmations for missing parking spaces', function () {
    $user = User::factory()->create();
    DB::table('parking_space_confirmations')->insert([
        'parking_space_id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'confirmed_at' => now(),
    ]);
})->throws(QueryException::class);
