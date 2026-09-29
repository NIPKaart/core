<?php

use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use App\Services\DatasetDeliveryStorage;
use App\Services\GeoapifyDestinationGeocoder;
use App\Services\NominatimDestinationResolver;
use App\Services\PdokGeocoder;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;

arch('application code avoids debugging and unsafe PHP functions')->preset()->php();

/**
 * S3 requires an MD5 Content-MD5 header, and the geocoders hash cache keys and result IDs with SHA-1; neither protects a secret.
 */
arch('application code avoids insecure PHP functions')
    ->preset()->security()
    ->ignoring([
        DatasetDeliveryStorage::class,
        GeoapifyDestinationGeocoder::class,
        NominatimDestinationResolver::class,
        PdokGeocoder::class,
    ]);

arch('environment values are only read in configuration')
    ->expect('env')
    ->toOnlyBeUsedIn('config');

arch('parking source models stay independent of each other', function (string $model, array $otherSources) {
    expect($model)->not->toUse($otherSources);
})->with([
    'community' => [ParkingSpace::class, [ParkingMunicipal::class, ParkingOffstreet::class]],
    'municipal' => [ParkingMunicipal::class, [ParkingSpace::class, ParkingOffstreet::class]],
    'offstreet' => [ParkingOffstreet::class, [ParkingSpace::class, ParkingMunicipal::class]],
]);

arch('models extend Eloquent')
    ->expect('App\Models')
    ->toExtend(Model::class);

arch('enums are native enums')
    ->expect('App\Enums')
    ->toBeEnums();

arch('contracts are interfaces')
    ->expect('App\Contracts')
    ->toBeInterfaces();

arch('policies are named after their resource')
    ->expect('App\Policies')
    ->toHaveSuffix('Policy');

arch('requests extend form requests')
    ->expect('App\Http\Requests')
    ->toExtend(FormRequest::class);

arch('jobs are queued')
    ->expect('App\Jobs')
    ->toImplement(ShouldQueue::class);
