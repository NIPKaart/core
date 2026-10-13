<?php

use App\Enums\UserRole;
use App\Jobs\ProcessDatasetDelivery;
use App\Models\Country;
use App\Models\DatasetDelivery;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\ParkingOffstreet;
use App\Models\Province;
use App\Models\User;
use App\Notifications\DatasetImport\SourceAwaitingApproval;
use App\Services\DatasetDeliveryService;
use App\Services\DatasetDeliveryStorage;
use App\Services\OffstreetImportService;
use App\Services\OffstreetObservationService;
use App\Services\ParkingDiscovery;
use App\Services\SourceRegistrar;
use App\Support\GeoBounds;
use Aws\MockHandler;
use Aws\Result;
use Aws\S3\S3Client;
use Carbon\CarbonImmutable;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

/** Real collector exports fetched on 2026-10-13; original source times are retained. */
function gentDelivery(string $kind): array
{
    if ($kind === 'catalog') {
        return json_decode(<<<'JSON'
{
  "format": "nipkaart-offstreet-catalog-3",
  "dataset": "be-gent-parking",
  "delivery_id": "69a10ef0-6067-4647-b146-e179922e433e",
  "retrieved_at": "2026-10-13T10:19:14.705422Z",
  "selection": "live-facilities-all",
  "source": {
    "name": "Gent realtime parkeervoorzieningen",
    "publisher": "Mobiliteitsbedrijf Gent",
    "source_url": "https://data.stad.gent/api/records/1.0/search/?dataset=bezetting-parkeergarages-real-time",
    "licence": null,
    "terms_url": "https://www.vlaanderen.be/digitaal-vlaanderen/onze-diensten-en-platformen/open-data/voorwaarden-voor-het-hergebruik-van-overheidsinformatie/modellicentie-gratis-hergebruik",
    "attribution": "Mobiliteitsbedrijf Gent; Real time bezetting parkeergarages Gent; Modellicentie Gratis Hergebruik; door NIPKaart geselecteerd en genormaliseerd.",
    "area": {
      "country": "BE",
      "subdivision": "BE-VOV",
      "municipality": {
        "scheme": "be-ins",
        "code": "44021",
        "name": "Gent"
      }
    },
    "bounds": [
      3.65,
      50.98,
      3.8,
      51.12
    ],
    "expected_interval_hours": 24
  },
  "complete": true,
  "source_count": 14,
  "records": [
    {
      "external_id": "https://be.parkindigo.com/nl/car-park/parking-dok-noord",
      "name": "Dok noord",
      "source_name": "Dok noord",
      "facility_type": "garage",
      "geometry": {
        "type": "Point",
        "coordinates": [
          3.7328389913720565,
          51.065684935819604
        ]
      }
    },
    {
      "external_id": "https://stad.gent/nl/loop/mobiliteit-loop#Parkeerterreinen_Stad_Gent",
      "name": "The Loop",
      "source_name": "The Loop",
      "facility_type": "parking_lot",
      "geometry": {
        "type": "Point",
        "coordinates": [
          3.6864592214319964,
          51.02542334883013
        ]
      }
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/park-and-ride-pr/pr-loopexpo",
      "name": "P+R The Loop",
      "source_name": "P+R The Loop",
      "facility_type": "park_and_ride",
      "geometry": {
        "type": "Point",
        "coordinates": [
          3.69519252261,
          51.024483197
        ]
      }
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-het-getouw",
      "name": "Getouw",
      "source_name": "Getouw",
      "facility_type": "garage",
      "geometry": {
        "type": "Point",
        "coordinates": [
          3.7148313576713052,
          51.072569883800206
        ]
      }
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-ledeberg",
      "name": "Ledeberg",
      "source_name": "Ledeberg",
      "facility_type": "park_and_ride",
      "geometry": {
        "type": "Point",
        "coordinates": [
          3.738571094371151,
          51.03634169048174
        ]
      }
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-ramen",
      "name": "Ramen",
      "source_name": "Ramen",
      "facility_type": "garage",
      "geometry": {
        "type": "Point",
        "coordinates": [
          3.71653,
          51.05532
        ]
      }
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-reep",
      "name": "Reep",
      "source_name": "Reep",
      "facility_type": "garage",
      "geometry": {
        "type": "Point",
        "coordinates": [
          3.7298928896398924,
          51.05215838523151
        ]
      }
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-savaan",
      "name": "Savaan",
      "source_name": "Savaan",
      "facility_type": "garage",
      "geometry": {
        "type": "Point",
        "coordinates": [
          3.7234627726667133,
          51.04877362543108
        ]
      }
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-sint-michiels",
      "name": "Sint-Michiels",
      "source_name": "Sint-Michiels",
      "facility_type": "garage",
      "geometry": {
        "type": "Point",
        "coordinates": [
          3.719727740000235,
          51.05311004768356
        ]
      }
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-sint-pietersplein",
      "name": "Sint-Pietersplein",
      "source_name": "Sint-Pietersplein",
      "facility_type": "garage",
      "geometry": {
        "type": "Point",
        "coordinates": [
          3.7259818626205483,
          51.04202834988112
        ]
      }
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-tolhuis",
      "name": "Tolhuis",
      "source_name": "Tolhuis",
      "facility_type": "garage",
      "geometry": {
        "type": "Point",
        "coordinates": [
          3.724968367281895,
          51.0637023559265
        ]
      }
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-vrijdagmarkt",
      "name": "Vrijdagmarkt",
      "source_name": "Vrijdagmarkt",
      "facility_type": "garage",
      "geometry": {
        "type": "Point",
        "coordinates": [
          3.726071777876147,
          51.05713405953412
        ]
      }
    },
    {
      "external_id": "https://www.belgiantrain.be/nl/station-information/car-or-bike-at-station/b-parking/my-b-parking/gent-dampoort",
      "name": "B-Park Dampoort",
      "source_name": "B-Park Dampoort",
      "facility_type": "parking_lot",
      "geometry": {
        "type": "Point",
        "coordinates": [
          3.73956,
          51.0561
        ]
      }
    },
    {
      "external_id": "https://www.belgiantrain.be/nl/station-information/car-or-bike-at-station/b-parking/my-b-parking/gentstpieters",
      "name": "B-Park Gent Sint-Pieters",
      "source_name": "B-Park Gent Sint-Pieters",
      "facility_type": "garage",
      "geometry": {
        "type": "Point",
        "coordinates": [
          3.70502,
          51.0369
        ]
      }
    }
  ]
}
JSON, true, flags: JSON_THROW_ON_ERROR);
    }

    return json_decode(<<<'JSON'
{
  "format": "nipkaart-offstreet-observations-2",
  "dataset": "be-gent-parking",
  "selection": "live-facilities-all",
  "delivery_id": "3d755e83-be24-41f6-a2bd-c570bb64ee02",
  "fetched_at": "2026-10-13T10:19:15.143463Z",
  "source_count": 14,
  "records": [
    {
      "external_id": "https://be.parkindigo.com/nl/car-park/parking-dok-noord",
      "observed_at": "2026-10-13T10:17:00Z",
      "source_state": "ok",
      "status": "counting",
      "capacity": 550,
      "available": 344
    },
    {
      "external_id": "https://stad.gent/nl/loop/mobiliteit-loop#Parkeerterreinen_Stad_Gent",
      "observed_at": "2026-10-13T10:16:34Z",
      "source_state": "ok",
      "status": "counting",
      "capacity": 2490,
      "available": 2257
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/park-and-ride-pr/pr-loopexpo",
      "observed_at": "2026-10-13T10:16:34Z",
      "source_state": "ok",
      "status": "counting",
      "capacity": 146,
      "available": 72
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-het-getouw",
      "observed_at": "2026-10-13T10:16:38Z",
      "source_state": "ok",
      "status": "counting",
      "capacity": 347,
      "available": 300
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-ledeberg",
      "observed_at": "2026-10-13T10:16:37Z",
      "source_state": "ok",
      "status": "counting",
      "capacity": 461,
      "available": 142
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-ramen",
      "observed_at": "2026-10-13T10:16:45Z",
      "source_state": "ok",
      "status": "counting",
      "capacity": 255,
      "available": 103
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-reep",
      "observed_at": "2026-10-13T10:16:38Z",
      "source_state": "ok",
      "status": "counting",
      "capacity": 455,
      "available": 155
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-savaan",
      "observed_at": "2026-10-13T10:16:38Z",
      "source_state": "ok",
      "status": "counting",
      "capacity": 512,
      "available": 235
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-sint-michiels",
      "observed_at": "2026-10-13T10:16:38Z",
      "source_state": "ok",
      "status": "counting",
      "capacity": 450,
      "available": 219
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-sint-pietersplein",
      "observed_at": "2026-10-13T10:16:38Z",
      "source_state": "ok",
      "status": "counting",
      "capacity": 700,
      "available": 46
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-tolhuis",
      "observed_at": "2026-10-13T10:16:37Z",
      "source_state": "ok",
      "status": "counting",
      "capacity": 148,
      "available": 62
    },
    {
      "external_id": "https://stad.gent/nl/mobiliteit-openbare-werken/parkeren/parkings-gent/parking-vrijdagmarkt",
      "observed_at": "2026-10-13T10:16:45Z",
      "source_state": "ok",
      "status": "counting",
      "capacity": 580,
      "available": 312
    },
    {
      "external_id": "https://www.belgiantrain.be/nl/station-information/car-or-bike-at-station/b-parking/my-b-parking/gent-dampoort",
      "observed_at": "2026-10-13T10:14:55Z",
      "source_state": "ok",
      "status": "counting",
      "capacity": 90,
      "available": 51
    },
    {
      "external_id": "https://www.belgiantrain.be/nl/station-information/car-or-bike-at-station/b-parking/my-b-parking/gentstpieters",
      "observed_at": "2026-10-13T10:16:06Z",
      "source_state": "ok",
      "status": "counting",
      "capacity": 400,
      "available": 85
    }
  ]
}
JSON, true, flags: JSON_THROW_ON_ERROR);
}

it('discovers, approves, reviews and publishes the real complete Gent catalog without losing facility types or identity', function () {
    $catalog = gentDelivery('catalog');
    $observations = gentDelivery('observations');
    $this->travelTo(CarbonImmutable::parse($observations['fetched_at'])->addSecond());
    Province::factory()->state(['geocode' => 'BE-VOV'])->for(Country::factory()->state(['code' => 'BE']))->create();
    $user = User::factory()->create();
    $user->assignRole(UserRole::ADMIN);
    Queue::fake([ProcessDatasetDelivery::class]);
    Notification::fake([SourceAwaitingApproval::class]);
    config(['dataset-deliveries.enabled' => true, 'filesystems.disks.dataset-deliveries.bucket' => 'gent-test']);
    $handler = new MockHandler;
    $client = new S3Client(['version' => 'latest', 'region' => 'auto', 'credentials' => ['key' => 'test', 'secret' => 'test'], 'handler' => $handler, 'retries' => 0]);
    app()->instance(DatasetDeliveryStorage::class, new DatasetDeliveryStorage($client));
    $json = json_encode($catalog, JSON_THROW_ON_ERROR);
    $key = 'offstreet/be-gent-parking/'.$catalog['delivery_id'].'.json';
    $handler->append(new Result(['IsTruncated' => false]));
    $handler->append(new Result(['CommonPrefixes' => [['Prefix' => 'offstreet/be-gent-parking/']], 'IsTruncated' => false]));
    $handler->append(new Result(['Contents' => [['Key' => $key, 'ETag' => '"gent"', 'LastModified' => $catalog['retrieved_at']]], 'IsTruncated' => false]));
    $handler->append(gentObject($json));

    app(DatasetDeliveryService::class)->discover();

    $source = DatasetSource::sole();
    expect($source)->code->toBe('be-gent-parking')->approval_state->toBe('pending')->registration_error->toBeNull();
    $this->assertDatabaseCount('parking_offstreet_spaces', 0);
    Queue::assertNothingPushed();
    Notification::assertSentTo($user, SourceAwaitingApproval::class);
    app(SourceRegistrar::class)->approve($source, $user, 'Isolated Gent source acceptance');
    expect($source->fresh()->municipality)->code_scheme->toBe('be-ins')->code->toBe('44021')->name->toBe('Gent');
    Queue::assertPushed(ProcessDatasetDelivery::class);
    $handler->append(gentObject($json));
    app(DatasetDeliveryService::class)->process(DatasetDelivery::sole()->id);
    $import = DatasetImport::sole();
    $service = app(OffstreetImportService::class);
    $review = $service->review($import);
    expect($review['counts'])->toMatchArray(['new' => 14, 'conflict' => 0]);
    $this->assertDatabaseCount('parking_offstreet_spaces', 0);
    $service->decide($import, $user, 'publish', null, $review['token']);
    $this->assertDatabaseCount('parking_offstreet_spaces', 14);
    $this->assertDatabaseCount('parking_municipal_spaces', 0);
    expect(ParkingOffstreet::where('parking_type', 'parking_lot')->pluck('name')->sort()->values()->all())->toBe(['B-Park Dampoort', 'The Loop']);
    expect(ParkingOffstreet::where('parking_type', 'parkandride')->pluck('name')->sort()->values()->all())->toBe(['Ledeberg', 'P+R The Loop']);
    expect(ParkingOffstreet::where('parking_type', 'garage')->count())->toBe(10);
    $spaces = ParkingOffstreet::all()->keyBy('external_id');
    foreach ($catalog['records'] as $record) {
        expect($spaces[$record['external_id']]->source_record)->toEqual($record);
    }
    $bounds = new GeoBounds(...$catalog['source']['bounds']);
    expect(app(ParkingDiscovery::class)->inViewport($bounds))->toHaveCount(14);
    $this->get(route('garages'))->assertInertia(fn (Assert $page) => $page->component('frontend/garages')->count('municipalities.0.garages', 14));

    $ids = $spaces->pluck('id', 'external_id')->all();
    $repeat = [...$catalog, 'delivery_id' => (string) Str::uuid(), 'retrieved_at' => now()->utc()->format('Y-m-d\TH:i:s.u\Z')];
    $second = $service->intake(json_encode($repeat, JSON_THROW_ON_ERROR), $user);
    $review = $service->review($second);
    expect($review['counts'])->toMatchArray(['new' => 0, 'unchanged' => 14, 'changed' => 0]);
    $service->decide($second, $user, 'publish', null, $review['token']);
    expect(ParkingOffstreet::pluck('id', 'external_id')->all())->toEqual($ids);

    expect(gentIngest($handler, $observations)['be-gent-parking'])->toBe(['applied' => 14, 'unknown' => 0]);
    foreach ($observations['records'] as $record) {
        $space = ParkingOffstreet::where('external_id', $record['external_id'])->sole();
        expect($space->observed_at->utc()->format('Y-m-d\TH:i:s\Z'))->toBe($record['observed_at']);
        expect($space->free_space)->toBe($record['available']);
        expect($space->availability())->toBe('current');
    }
    $this->travel(1)->minute();
    expect(gentIngest($handler, $observations)['be-gent-parking'])->toBe(['applied' => 0, 'unknown' => 0]);
    $old = $observations;
    $old['records'][0]['observed_at'] = now()->subHour()->utc()->format('Y-m-d\TH:i:s\Z');
    $old['records'][0]['available'] = 0;
    expect(gentIngest($handler, $old)['be-gent-parking'])->toBe(['applied' => 0, 'unknown' => 0]);
    $missing = $observations;
    $missing['records'] = array_slice($missing['records'], 1);
    $missing['source_count'] = count($missing['records']);
    expect(gentIngest($handler, $missing)['be-gent-parking'])->toBe(['applied' => 0, 'unknown' => 0]);
    $this->assertDatabaseCount('parking_offstreet_spaces', 14);
    $this->travel(11)->minutes();
    expect(ParkingOffstreet::first()->publicOccupancy())->toMatchArray(['availability' => 'stale', 'free_space' => null]);
    $failed = $observations;
    $failed['records'][0]['source_state'] = 'error';
    $failed['records'][0]['observed_at'] = now()->subSecond()->utc()->format('Y-m-d\TH:i:s\Z');
    expect(gentIngest($handler, $failed)['be-gent-parking'])->toBe(['applied' => 1, 'unknown' => 0]);
    expect(ParkingOffstreet::where('external_id', $failed['records'][0]['external_id'])->sole()->publicOccupancy())->toMatchArray(['availability' => 'unavailable', 'free_space' => null]);
});

function gentObject(string $json): Result
{
    return new Result(['Body' => Utils::streamFor($json), 'ContentLength' => strlen($json), 'Metadata' => ['sha256' => hash('sha256', $json)]]);
}

/** Feed the real consumer via its storage boundary, never a real bucket or application database. */
function gentIngest(MockHandler $handler, array $data): array
{
    $data['delivery_id'] = (string) Str::uuid();
    $data['fetched_at'] = now()->utc()->format('Y-m-d\TH:i:s.u\Z');
    $key = 'offstreet-observations/be-gent-parking/'.now()->utc()->format('Ymd\THis\Z').'-'.$data['delivery_id'].'.json';
    $handler->append(new Result(['Contents' => [['Key' => $key, 'ETag' => '"measurement"']], 'IsTruncated' => false]));
    $handler->append(gentObject(json_encode($data, JSON_THROW_ON_ERROR)));

    return app(OffstreetObservationService::class)->ingest();
}
