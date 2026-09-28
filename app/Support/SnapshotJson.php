<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;
use JsonException;
use stdClass;

/**
 * Bounded, strict JSON decoding shared by every delivery format.
 */
final class SnapshotJson
{
    public const int MAX_BYTES = 33554432;

    /**
     * Decodes one JSON object, rejecting oversized files, other JSON values and duplicate keys.
     *
     * @return array{0: array<string, mixed>, 1: stdClass}
     */
    public static function decode(string $json): array
    {
        if (strlen($json) > self::MAX_BYTES) {
            self::fail('file', 'Het bestand is groter dan 32 MiB.');
        }
        try {
            $object = json_decode($json, false, 32, JSON_THROW_ON_ERROR);
            if (! $object instanceof stdClass) {
                self::fail('file', 'Verwacht één JSON-object.');
            }
            self::rejectDuplicateKeys($json);

            return [json_decode($json, true, 32, JSON_THROW_ON_ERROR), $object];
        } catch (JsonException) {
            self::fail('file', 'Ongeldige JSON of te diep geneste gegevens.');
        }
    }

    /** JSON decoding is already complete; this pass rejects duplicate object keys. */
    private static function rejectDuplicateKeys(string $json): void
    {
        preg_match_all('/"(?:[^"\\\\]|\\\\.)*"|[{}\[\]:,]/s', $json, $matches);
        $stack = [];
        foreach ($matches[0] as $token) {
            if ($token === '{' || $token === '[') {
                $stack[] = ['object' => $token === '{', 'key' => $token === '{', 'seen' => []];
            } elseif ($token === '}' || $token === ']') {
                array_pop($stack);
            } elseif ($stack !== []) {
                $i = array_key_last($stack);
                if ($stack[$i]['object']) {
                    if ($token === ',') {
                        $stack[$i]['key'] = true;
                    } elseif ($token === ':') {
                        $stack[$i]['key'] = false;
                    } elseif ($token[0] === '"' && $stack[$i]['key']) {
                        $key = json_decode($token, true, 32, JSON_THROW_ON_ERROR);
                        if (isset($stack[$i]['seen'][$key])) {
                            self::fail('file', 'Dubbele JSON-sleutel: '.$key);
                        }
                        $stack[$i]['seen'][$key] = true;
                    }
                }
            }
        }
    }

    private static function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
