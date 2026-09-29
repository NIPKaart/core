<?php

use App\Models\Municipality;
use Database\Seeders\PermissionsTableSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

use function Pest\Laravel\withoutVite;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind a different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->beforeEach(function () {
        withoutVite();
        Http::preventStrayRequests();

        $this->seed(PermissionsTableSeeder::class);
    })
    ->use(RefreshDatabase::class)
    ->in('Feature');

/**
 * Answer server-side reverse geocoding with an address in the given municipality.
 *
 * @param  array<string, mixed>  $overrides
 */
function fakeReverseGeocoding(Municipality $municipality, array $overrides = []): void
{
    config(['services.geoapify.key' => 'test-key']);
    Http::fake(['api.geoapify.com/v1/geocode/reverse*' => Http::response(['results' => [[
        'country_code' => strtolower($municipality->country->code),
        'state' => $municipality->province->name,
        'city' => $municipality->name,
        'street' => 'Teststraat',
        'postcode' => '1000 AA',
        ...$overrides,
    ]]])]);
}
