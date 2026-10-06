<?php

use App\Support\SourceDescription;
use Database\Factories\DatasetSourceFactory;
use Illuminate\Validation\ValidationException;

it('accepts official municipality identifiers for their own country', function (string $country, string $subdivision, string $scheme, string $code) {
    $description = DatasetSourceFactory::municipalDescription([
        'area' => ['country' => $country, 'subdivision' => $subdivision, 'municipality' => ['scheme' => $scheme, 'code' => $code, 'name' => 'Municipality']],
    ]);

    expect(SourceDescription::validate($description)['area'])->toBe($description['area']);
})->with([
    'Dutch CBS' => ['NL', 'NL-NH', 'nl-cbs', 'GM0363'],
    'Belgian INS' => ['BE', 'BE-WNA', 'be-ins', '92094'],
    'Belgian leading zero' => ['BE', 'BE-WNA', 'be-ins', '01234'],
]);

it('rejects identifiers from a different country and malformed Belgian codes', function (string $country, string $scheme, string $code, string $field, string $message) {
    $description = DatasetSourceFactory::municipalDescription([
        'area' => ['country' => $country, 'subdivision' => $country.'-NH', 'municipality' => ['scheme' => $scheme, 'code' => $code, 'name' => 'Municipality']],
    ]);

    try {
        SourceDescription::validate($description);
        $this->fail('Invalid municipality identity was accepted.');
    } catch (ValidationException $exception) {
        expect($exception->errors())->toBe([$field => [$message]]);
    }
})->with([
    'Belgian scheme in Netherlands' => ['NL', 'be-ins', '92094', 'source.area.municipality.scheme', 'Het gemeentecodestelsel hoort niet bij het opgegeven land.'],
    'Dutch scheme in Belgium' => ['BE', 'nl-cbs', 'GM0363', 'source.area.municipality.scheme', 'Het gemeentecodestelsel hoort niet bij het opgegeven land.'],
    'Dutch scheme in Germany' => ['DE', 'nl-cbs', 'GM0363', 'source.area.municipality.scheme', 'Het gemeentecodestelsel hoort niet bij het opgegeven land.'],
    'short Belgian code' => ['BE', 'be-ins', '9209', 'source.area.municipality.code', 'Ongeldige officiële gemeentecode.'],
    'long Belgian code' => ['BE', 'be-ins', '920940', 'source.area.municipality.code', 'Ongeldige officiële gemeentecode.'],
    'prefixed Belgian code' => ['BE', 'be-ins', 'BE92094', 'source.area.municipality.code', 'Ongeldige officiële gemeentecode.'],
]);
