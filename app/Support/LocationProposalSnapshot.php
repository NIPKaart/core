<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Generator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Parses one bounded proposal snapshot without materializing its national records array. */
final class LocationProposalSnapshot
{
    public const string FORMAT = 'nipkaart-location-proposals-1';

    public const int MAX_BYTES = 64 * 1024 * 1024;

    public const int MAX_RECORDS = 150_000;

    private const array FIELDS = ['format', 'dataset', 'delivery_id', 'retrieved_at', 'selection', 'source', 'complete', 'source_count', 'pages_fetched', 'upstream_total', 'records'];

    /** Match a JSON value at the cursor, including strings with escaped delimiters. */
    private const string VALUE = <<<'REGEX'
~(?(DEFINE)(?<s>"(?:[^"\\\x00-\x1f]++|\\.)*+")(?<v>(?&s)|\{(?:[ \t\r\n]*(?&s)[ \t\r\n]*:[ \t\r\n]*(?&v)[ \t\r\n]*(?:,[ \t\r\n]*(?&s)[ \t\r\n]*:[ \t\r\n]*(?&v)[ \t\r\n]*)*+)?[ \t\r\n]*\}|\[(?:[ \t\r\n]*(?&v)[ \t\r\n]*(?:,[ \t\r\n]*(?&v)[ \t\r\n]*)*+)?[ \t\r\n]*\]|true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?))\G[ \t\r\n]*\K(?&v)~s
REGEX;

    /** @return array{data: array, recordsOffset: int} */
    public static function envelope(string $json): array
    {
        if (strlen($json) > self::MAX_BYTES) {
            self::fail();
        }

        $offset = 0;
        self::expect($json, $offset, '{');
        $members = [];
        $keys = [];
        $recordsOffset = null;

        do {
            $key = self::value($json, $offset);
            $field = json_decode($key);
            if (! in_array($field, self::FIELDS, true) || isset($keys[$field])) {
                self::fail();
            }
            $keys[$field] = true;
            self::expect($json, $offset, ':');
            if ($field === 'records') {
                self::expect($json, $offset, '[');
                $recordsOffset = $offset;
                foreach (self::recordJson($json, $offset) as $_record) {
                    // Advance past the records array to read the rest of the envelope.
                }
                $members[] = $key.':[]';
            } else {
                $members[] = $key.':'.self::value($json, $offset);
            }
        } while (self::consume($json, $offset, ','));

        self::expect($json, $offset, '}');
        if (strspn($json, " \t\r\n", $offset) !== strlen($json) - $offset || $recordsOffset === null) {
            self::fail();
        }

        [$data] = SnapshotJson::decode('{'.implode(',', $members).'}');
        if (count($data) !== count(self::FIELDS)
            || $data['format'] !== self::FORMAT || $data['complete'] !== true
            || ! is_string($data['dataset']) || ! preg_match('/^[a-z0-9][a-z0-9-]{1,62}$/D', $data['dataset'])
            || ! is_string($data['delivery_id']) || ! Str::isUuid($data['delivery_id'])
            || ! is_string($data['selection']) || ! preg_match('/^[a-z0-9][a-z0-9-]{1,62}$/D', $data['selection'])
            || ! is_int($data['source_count']) || $data['source_count'] < 1 || $data['source_count'] > self::MAX_RECORDS
            || $data['pages_fetched'] !== 1
            || ($data['upstream_total'] !== null && $data['upstream_total'] !== $data['source_count'])
            || ! is_string($data['retrieved_at'])
            || ! preg_match('/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?Z$/D', $data['retrieved_at'])) {
            self::fail();
        }

        $date = substr($data['retrieved_at'], 0, 10);
        self::validateDate($date);
        $data['retrieved_at'] = CarbonImmutable::parse($data['retrieved_at']);
        if ($data['retrieved_at']->gt(now()->addMinutes(5))) {
            self::fail();
        }
        $data['source'] = SourceDescription::validate($data['source'], national: true);

        return ['data' => $data, 'recordsOffset' => $recordsOffset];
    }

    /** @return Generator<int, array<string, mixed>> */
    public static function points(string $json, int $offset, array $data): Generator
    {
        $seen = [];
        [$west, $south, $east, $north] = $data['source']['bounds'];
        foreach (self::recordJson($json, $offset) as $record) {
            [$point] = SnapshotJson::decode($record);
            $expected = ['external_id', 'geometry', 'municipality_code', 'source_last_seen_on', 'under_sign_types', 'personal'];
            if (array_diff($expected, array_keys($point)) !== [] || count($point) !== count($expected)
                || ! is_string($point['external_id']) || ! Str::isUuid($point['external_id'])
                || $point['external_id'] !== strtolower($point['external_id'])
                || isset($seen[$point['external_id']]) || count($seen) >= $data['source_count']
                || ! is_bool($point['personal'])
                || ! is_array($point['under_sign_types']) || ! array_is_list($point['under_sign_types'])
                || array_any($point['under_sign_types'], fn (mixed $type): bool => ! in_array($type, ['VRIJ', 'EMIS', 'KEN', 'RICH', 'UIT', 'VOOR', 'TIJD'], true))
                || (in_array('KEN', $point['under_sign_types'], true) && ! $point['personal'])
                || ($point['municipality_code'] !== null && (! is_string($point['municipality_code']) || ! preg_match('/^GM[0-9]{4}$/D', $point['municipality_code'])))) {
                self::fail();
            }
            if ($point['source_last_seen_on'] !== null) {
                self::validateDate($point['source_last_seen_on']);
            }
            $geometry = $point['geometry'];
            $coordinates = $geometry['coordinates'] ?? null;
            if (($geometry['type'] ?? null) !== 'Point' || count($geometry) !== 2
                || ! is_array($coordinates) || ! array_is_list($coordinates) || count($coordinates) !== 2) {
                self::fail();
            }
            [$longitude, $latitude] = $coordinates;
            if ((! is_int($longitude) && ! is_float($longitude)) || (! is_int($latitude) && ! is_float($latitude))
                || ! ($longitude >= $west && $longitude <= $east && $latitude >= $south && $latitude <= $north)) {
                self::fail();
            }
            $seen[$point['external_id']] = true;

            yield [
                ...$point, 'longitude' => $longitude, 'latitude' => $latitude,
            ];
        }
        if (count($seen) !== $data['source_count']) {
            self::fail();
        }
    }

    private static function validateDate(mixed $date): void
    {
        if (! is_string($date) || ! preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $date, $parts)
            || ! checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) {
            self::fail();
        }
    }

    /** @return Generator<int, string> */
    private static function recordJson(string $json, int &$offset): Generator
    {
        if (self::consume($json, $offset, ']')) {
            return;
        }
        $count = 0;
        do {
            if (++$count > self::MAX_RECORDS) {
                self::fail();
            }
            yield self::value($json, $offset);
        } while (self::consume($json, $offset, ','));
        self::expect($json, $offset, ']');
    }

    private static function value(string $json, int &$offset): string
    {
        if (! preg_match(self::VALUE, substr($json, $offset, 16385), $matches, PREG_OFFSET_CAPTURE)
            || $matches[0][1] + strlen($matches[0][0]) > 16384) {
            self::fail();
        }
        $offset += $matches[0][1] + strlen($matches[0][0]);

        return $matches[0][0];
    }

    private static function consume(string $json, int &$offset, string $token): bool
    {
        $offset += strspn($json, " \t\r\n", $offset);
        if (($json[$offset] ?? null) !== $token) {
            return false;
        }
        $offset++;

        return true;
    }

    private static function expect(string $json, int &$offset, string $token): void
    {
        if (! self::consume($json, $offset, $token)) {
            self::fail();
        }
    }

    private static function fail(): never
    {
        throw ValidationException::withMessages(['file' => 'Invalid location proposal snapshot.']);
    }
}
