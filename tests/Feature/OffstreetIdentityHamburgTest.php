<?php

use App\Enums\UserRole;
use App\Models\Country;
use App\Models\DatasetSource;
use App\Models\Municipality;
use App\Models\ParkingOffstreet;
use App\Models\Province;
use App\Models\User;
use App\Services\OffstreetImportService;
use Illuminate\Support\Str;

/** Real complete Hamburg snapshots fetched 2026-10-11 20:08:48 and 20:10:44 UTC; no measurements. */
function hamburgIdentityRows(): array
{
    return json_decode(<<<'JSON'
[
["12686527","12686565","Volksdorf",[10.161690000000121,53.64967000090012],[10.161690000000121,53.64967000090012]],
["12686528","12686566","Meiendorfer Weg",[10.155720000000114,53.63889000090022],[10.155720000000114,53.63889000090022]],
["12686529","12686567","Trabrennbahn",[10.10224000000009,53.598630000900634],[10.10224000000009,53.598630000900634]],
["12686530","12686568","Poppenbüttel",[10.09261000000009,53.65072000090011],[10.09261000000009,53.65072000090011]],
["12686531","12686569","Poppenbüttel",[10.094350000000087,53.652080000900085],[10.094350000000087,53.652080000900085]],
["12686532","12686570","Berne",[10.139650000000108,53.62728000090034],[10.139650000000108,53.62728000090034]],
["12686533","12686571","Steinfurther Allee",[10.138460000000107,53.54106000090119],[10.138460000000107,53.54106000090119]],
["12686534","12686572","Rahlstedt",[10.151750000000115,53.60431000090059],[10.151750000000115,53.60431000090059]],
["12686535","12686573","Bergedorf",[10.203920000000146,53.489420000901696],[10.203920000000146,53.489420000901696]],
["12686536","12686574","Nettelnburg Nord",[10.182720000000131,53.48884000090171],[10.182720000000131,53.48884000090171]],
["12686537","12686575","Bergedorf",[10.204760000000144,53.48986000090168],[10.204760000000144,53.48986000090168]],
["12686538","12686576","Horner Rennbahn",[10.087830000000086,53.554240000901075],[10.087830000000086,53.554240000901075]],
["12686539","12686577","Neugraben",[9.855110000000025,53.47452000090183],[9.855110000000025,53.47452000090183]],
["12686540","12686578","Harburg",[9.993430000000057,53.45623000090202],[9.993430000000057,53.45623000090202]],
["12686541","12686579","Veddel",[10.012960000000062,53.52028000090139],[10.012960000000062,53.52028000090139]],
["12686542","12686580","Elbgaustrasse",[9.89161000000003,53.60392000090057],[9.89161000000003,53.60392000090057]],
["12686543","12686581","Bahrenfeld",[9.907760000000035,53.560240000901],[9.907760000000035,53.560240000901]],
["12686544","12686582","Klein Flottbek",[9.863360000000029,53.55869000090101],[9.863360000000029,53.55869000090101]],
["12686545","12686583","Hagenbecks Tierpark",[9.942823000000041,53.595144000900646],[9.942823000000041,53.595144000900646]],
["12686546","12686584","Neuwiedenthal",[9.87887000000003,53.47337000090185],[9.87887000000003,53.47337000090185]],
["12686547","12686585","Neuwiedenthal",[9.876070000000032,53.47280000090184],[9.876070000000032,53.47280000090184]],
["12686548","12686586","Veddel",[10.013786000000062,53.52030600090139],[10.013786000000062,53.52030600090139]],
["12686549","12686587","Nettelnburg West",[10.179910000000131,53.4875200009017],[10.179910000000131,53.4875200009017]],
["12686550","12686588","Ohlsdorf",[10.032430000000069,53.61885000090042],[10.032430000000069,53.61885000090042]],
["12686551","12686589","Fuhlsbüttel",[10.025700000000064,53.63178000090031],[10.025700000000064,53.63178000090031]],
["12686552","12686590","Nettelnburg Ost",[10.182640000000132,53.487230000901704],[10.182640000000132,53.487230000901704]],
["12686553","12686591","Ohlstedt",[10.136563000000105,53.69551700089968],[10.136563000000105,53.69551700089968]],
["12686554","12686592","Hagenbecks Tierpark",[9.942490000000044,53.59546000090066],[9.942490000000044,53.59546000090066]],
["12686555","12686593","Langenhorn Nord",[10.01674000000006,53.66088000090001],[10.01674000000006,53.66088000090001]],
["12686556","12686594","Langenhorn Markt",[10.01731000000006,53.65053000090011],[10.01731000000006,53.65053000090011]],
["12686557","12686595","Lattenkamp",[9.994900000000058,53.60052000090061],[9.994900000000058,53.60052000090061]],
["12686558","12686596","Niendorf Markt",[9.951197000000043,53.622070000900386],[9.951197000000043,53.622070000900386]],
["12686559","12686597","Mittlerer Landweg",[10.132730000000107,53.49793000090161],[10.132730000000107,53.49793000090161]],
["12686560","12686598","Hochkamp",[9.842030000000022,53.560610000900994],[9.842030000000022,53.560610000900994]],
["12686561","12686599","Hochkamp",[9.842514000000024,53.56071700090099],[9.842514000000024,53.56071700090099]],
["12686562","12686600","Kiwittsmoor",[10.017650000000058,53.67471000089987],[10.017650000000058,53.67471000089987]],
["12686563","12686601","Schnelsen",[9.905930000000033,53.63357000090028],[9.905930000000033,53.63357000090028]],
["12686564","12686602","Langenhorn Süd",[10.01673800000006,53.66088400090004],[10.01673800000006,53.66088400090004]]
]
JSON, true, flags: JSON_THROW_ON_ERROR);
}

it('reconciles all facilities in the two real Hamburg catalogs without manual identity decisions', function () {
    $this->freezeTime();
    $description = json_decode(<<<'SOURCE'
{"name": "Hamburg Park + Ride Anlagen", "publisher": "Freie und Hansestadt Hamburg, Behörde für Verkehr und Mobilitätswende", "source_url": "https://api.hamburg.de/datasets/v1/p_und_r/collections/p_und_r/items", "licence": "DL-DE-BY-2.0", "terms_url": "https://suche.transparenz.hamburg.de/dataset/park-ride-anlagen-hamburg32", "attribution": "Freie und Hansestadt Hamburg, Behörde für Verkehr und Mobilitätswende (BVM); Park + Ride Anlagen Hamburg; Datenlizenz Deutschland - Namensnennung - Version 2.0; durch NIPKaart normalisiert.", "area": {"country": "DE", "subdivision": "DE-HH", "municipality": {"scheme": "de-ags", "code": "02000000", "name": "Hamburg"}}, "bounds": [9.7, 53.35, 10.35, 53.8], "expected_interval_hours": 24}
SOURCE, true, flags: JSON_THROW_ON_ERROR);
    $province = Province::factory()->state(['geocode' => 'DE-HH'])->for(Country::factory()->state(['code' => 'DE']))->create();
    $municipality = Municipality::factory()->for($province)->create(['name' => 'Hamburg', 'code_scheme' => 'de-ags', 'code' => '02000000']);
    DatasetSource::factory()->create([
        'code' => 'de-hamburg-pr', 'selection' => 'pr-all', 'target_type' => 'offstreet', 'municipality_id' => $municipality->id,
        ...DatasetSource::attributesFromDescription($description),
    ]);
    $user = User::factory()->create();
    $user->assignRole(UserRole::ADMIN);
    $service = app(OffstreetImportService::class);
    $records = fn (bool $repeat): array => array_map(fn (array $row): array => [
        'external_id' => $row[$repeat ? 1 : 0], 'name' => $row[2], 'source_name' => $row[2],
        'facility_type' => 'park_and_ride', 'geometry' => ['type' => 'Point', 'coordinates' => $row[$repeat ? 4 : 3]],
    ], hamburgIdentityRows());
    $catalog = fn (bool $repeat): array => [
        'format' => 'nipkaart-offstreet-catalog-3', 'dataset' => 'de-hamburg-pr', 'selection' => 'pr-all', 'source' => $description,
        'delivery_id' => (string) Str::uuid(), 'retrieved_at' => now()->subMinute()->utc()->format('Y-m-d\TH:i:s.u\Z'),
        'complete' => true, 'source_count' => 38, 'records' => $records($repeat),
    ];
    $first = $service->intake(json_encode($catalog(false), JSON_THROW_ON_ERROR), $user);
    $service->decide($first, $user, 'publish', null, $service->review($first)['token']);
    $original = ParkingOffstreet::get()->keyBy('external_id');
    $this->travel(5)->minutes();
    $second = $service->intake(json_encode($catalog(true), JSON_THROW_ON_ERROR), $user);
    $review = $service->review($second);
    expect($review['counts']['new'])->toBe(0);
    expect(collect($review['identities'])->where('method', 'geometry_name_type')->count())->toBe(38);
    expect($review['blockers'])->toBeEmpty();
    expect($review['counts'])->toMatchArray(['new' => 0, 'missing' => 0, 'conflict' => 0]);
    $service->decide($second->fresh(), $user, 'publish', null, $review['token']);

    expect($second->fresh()->identity_decisions)->toBeNull();

    $this->assertDatabaseCount('parking_offstreet_spaces', 38);
    foreach (hamburgIdentityRows() as $row) {
        expect(ParkingOffstreet::where('source_record->external_id', $row[1])->sole()->id)->toBe($original->get($row[0])->id);
    }
});
