<?php

namespace App\Support;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * The `source` block a collector sends with every delivery (ADR 0013).
 */
final class SourceDescription
{
    /** Official municipality code schemes; add one when the first source of a country needs it. */
    public const array SCHEMES = ['nl-cbs' => '/^GM\d{4}$/'];

    /**
     * Validates and normalizes a source block.
     *
     * @return array{name: string, publisher: string, source_url: string, licence: ?string, terms_url: string, attribution: string, area: array{country: string, subdivision: string, municipality: array{scheme: string, code: string, name: string}}, bounds: array{0: float, 1: float, 2: float, 3: float}, expected_interval_hours: int}
     */
    public static function validate(mixed $block): array
    {
        if (! is_array($block) || array_is_list($block)) {
            self::fail('source', 'De levering moet een bronbeschrijving bevatten.');
        }
        $keys = ['name', 'publisher', 'source_url', 'licence', 'terms_url', 'attribution', 'area', 'bounds', 'expected_interval_hours'];
        if (array_diff(array_keys($block), $keys) !== [] || array_diff($keys, array_keys($block)) !== []) {
            self::fail('source', 'Onverwachte of ontbrekende velden in de bronbeschrijving.');
        }
        Validator::make(['source' => $block], [
            'source.name' => ['required', 'string', 'max:255'],
            'source.publisher' => ['required', 'string', 'max:255'],
            'source.source_url' => ['required', 'string', 'max:2000', 'url:https'],
            'source.licence' => ['present', 'nullable', 'string', 'regex:/^[A-Za-z0-9.+-]{1,64}$/'],
            'source.terms_url' => ['required', 'string', 'max:2000', 'url:https'],
            'source.attribution' => ['required', 'string', 'max:1000'],
            'source.area' => ['required', 'array:country,subdivision,municipality'],
            'source.area.country' => ['required', 'string', 'regex:/^[A-Z]{2}$/'],
            'source.area.subdivision' => ['required', 'string', 'regex:/^[A-Z]{2}-[A-Z0-9]{1,3}$/'],
            'source.area.municipality' => ['required', 'array:scheme,code,name'],
            'source.area.municipality.scheme' => ['required', 'string', 'in:'.implode(',', array_keys(self::SCHEMES))],
            'source.area.municipality.code' => ['required', 'string', 'max:32'],
            'source.area.municipality.name' => ['required', 'string', 'max:255'],
            'source.bounds' => ['required', 'array', 'list', 'size:4'],
            'source.expected_interval_hours' => ['required', 'integer', 'min:1', 'max:8760'],
        ])->validate();
        $area = $block['area'];
        if (! str_starts_with($area['subdivision'], $area['country'].'-')) {
            self::fail('source.area.subdivision', 'De provincie hoort niet bij het opgegeven land.');
        }
        if (! preg_match(self::SCHEMES[$area['municipality']['scheme']], $area['municipality']['code'])) {
            self::fail('source.area.municipality.code', 'Ongeldige officiële gemeentecode.');
        }
        foreach ($block['bounds'] as $value) {
            if ((! is_int($value) && ! is_float($value)) || ! is_finite($value)) {
                self::fail('source.bounds', 'Verwacht vier getallen: west, zuid, oost, noord.');
            }
        }
        [$west, $south, $east, $north] = $block['bounds'];
        if ($west < -180 || $east > 180 || $south < -90 || $north > 90 || $west >= $east || $south >= $north) {
            self::fail('source.bounds', 'Ongeldige gebiedsgrenzen.');
        }
        if (! is_int($block['expected_interval_hours'])) {
            self::fail('source.expected_interval_hours', 'Verwacht een geheel aantal uren.');
        }
        $block['bounds'] = array_map(fn (int|float $value): float => (float) $value, $block['bounds']);

        return $block;
    }

    /** Fields an administrator approves; the delivery interval may change without re-approval. */
    public static function approvalFingerprint(array $description): string
    {
        return MunicipalSnapshot::fingerprint(Arr::except($description, ['expected_interval_hours']));
    }

    private static function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
