<?php

use App\Enums\ParkingStatus;
use App\Models\ParkingSpace;
use App\Services\ParkingDiscovery;
use App\Support\MapTile;

/** @return array{0: int, 1: int} */
function tileContaining(int $zoom, float $latitude, float $longitude): array
{
    $size = 2 ** $zoom;
    $radians = deg2rad($latitude);

    return [(int) floor(($longitude + 180) / 360 * $size), (int) floor((1 - log(tan($radians) + 1 / cos($radians)) / M_PI) / 2 * $size)];
}

test('an area returns every public record individually, including adjacent bays', function () {
    $spaces = ParkingSpace::factory()->count(2)->sequence(['longitude' => 4.9], ['longitude' => 4.90001])
        ->create(['latitude' => 52.37, 'status' => ParkingStatus::APPROVED]);
    ParkingSpace::factory()->create(['latitude' => 52.37, 'longitude' => 4.9, 'status' => ParkingStatus::REJECTED]);

    [$x, $y] = tileContaining(ParkingDiscovery::AREA_ZOOM, 52.37, 4.9);
    $response = $this->getJson("/map/parking/area/{$x}/{$y}")->assertOk()->assertJsonPath('truncated', false);

    expect(collect($response->json('points'))->pluck(0)->sort()->values()->all())
        ->toBe($spaces->map(fn (ParkingSpace $space) => 'community:'.$space->id)->sort()->values()->all());
});

test('a record on a shared area edge belongs to exactly one area', function () {
    $edge = (new MapTile(ParkingDiscovery::AREA_ZOOM, 260, 0))->bounds()->west;
    $space = ParkingSpace::factory()->create(['latitude' => 52, 'longitude' => $edge, 'status' => ParkingStatus::APPROVED]);
    [, $y] = tileContaining(ParkingDiscovery::AREA_ZOOM, 52, $edge);

    $this->getJson("/map/parking/area/259/{$y}")->assertOk()->assertJsonCount(0, 'points');
    $this->getJson("/map/parking/area/260/{$y}")->assertOk()->assertJsonPath('points.0.0', 'community:'.$space->id);
});

test('the area index lists only areas with public parking and counts what each area returns', function () {
    $edge = (new MapTile(ParkingDiscovery::AREA_ZOOM, 260, 0))->bounds()->west;
    ParkingSpace::factory()->create(['latitude' => 52, 'longitude' => $edge, 'status' => ParkingStatus::APPROVED]);
    ParkingSpace::factory()->count(2)->create(['latitude' => 52.37, 'longitude' => 4.9, 'status' => ParkingStatus::APPROVED]);
    ParkingSpace::factory()->create(['latitude' => 51.5, 'longitude' => 5.5, 'status' => ParkingStatus::PENDING]);

    $response = $this->getJson('/map/parking/areas')->assertOk()->assertJsonPath('zoom', ParkingDiscovery::AREA_ZOOM);

    expect($response->json('areas'))->toHaveCount(2);
    foreach ($response->json('areas') as [$x, $y, $count]) {
        $this->getJson("/map/parking/area/{$x}/{$y}")->assertJsonCount($count, 'points');
    }
});

test('map data outside the world is not found', function (string $path) {
    $this->getJson("/map/parking/{$path}")->assertNotFound();
})->with(['area/512/0', 'area/0/512', 'area/-1/0', 'overview/0/0']);

test('map data is cacheable by browsers', function () {
    $response = $this->getJson('/map/parking/area/0/0')->assertOk();

    expect($response->headers->get('Cache-Control'))->toContain('public')->toContain('max-age=60');
    expect($response->headers->get('ETag'))->not->toBeNull();
});
