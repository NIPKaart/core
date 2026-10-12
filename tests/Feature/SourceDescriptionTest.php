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
    'German Hamburg AGS' => ['DE', 'DE-HH', 'de-ags', '02000000'],
    'Belgian leading zero' => ['BE', 'BE-WNA', 'be-ins', '01234'],
    'Swedish SCB leading zero' => ['SE', 'SE-AB', 'se-scb', '0180'],
]);

it('rejects identifiers from a different country and malformed municipality codes', function (string $country, string $scheme, string $code, string $field, string $message) {
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
    'German scheme in Belgium' => ['BE', 'de-ags', '02000000', 'source.area.municipality.scheme', 'Het gemeentecodestelsel hoort niet bij het opgegeven land.'],
    'short German code' => ['DE', 'de-ags', '2000000', 'source.area.municipality.code', 'Ongeldige officiële gemeentecode.'],
    'long German code' => ['DE', 'de-ags', '020000000', 'source.area.municipality.code', 'Ongeldige officiële gemeentecode.'],
    'prefixed German code' => ['DE', 'de-ags', 'DE02000000', 'source.area.municipality.code', 'Ongeldige officiële gemeentecode.'],
    'short Belgian code' => ['BE', 'be-ins', '9209', 'source.area.municipality.code', 'Ongeldige officiële gemeentecode.'],
    'long Belgian code' => ['BE', 'be-ins', '920940', 'source.area.municipality.code', 'Ongeldige officiële gemeentecode.'],
    'prefixed Belgian code' => ['BE', 'be-ins', 'BE92094', 'source.area.municipality.code', 'Ongeldige officiële gemeentecode.'],
    'Swedish scheme in Netherlands' => ['NL', 'se-scb', '0180', 'source.area.municipality.scheme', 'Het gemeentecodestelsel hoort niet bij het opgegeven land.'],
    'short Swedish code' => ['SE', 'se-scb', '180', 'source.area.municipality.code', 'Ongeldige officiële gemeentecode.'],
]);

it('uses a configured scheme for its allowed values country and code format', function () {
    config(['municipality-code-schemes.additional' => ['country' => 'NL', 'pattern' => '/^X[0-9]{3}$/']]);
    $description = DatasetSourceFactory::municipalDescription([
        'area' => ['country' => 'NL', 'subdivision' => 'NL-NH', 'municipality' => ['scheme' => 'additional', 'code' => 'X036', 'name' => 'Municipality']],
    ]);

    expect(SourceDescription::validate($description)['area'])->toBe($description['area']);

    $description['area']['municipality']['code'] = 'GM0363';
    expect(fn () => SourceDescription::validate($description))->toThrow(ValidationException::class, 'Ongeldige officiële gemeentecode.');

    $description['area']['municipality']['code'] = 'X036';
    $description['area']['country'] = 'BE';
    $description['area']['subdivision'] = 'BE-WNA';
    expect(fn () => SourceDescription::validate($description))->toThrow(ValidationException::class, 'Het gemeentecodestelsel hoort niet bij het opgegeven land.');
});
