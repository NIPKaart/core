<?php

namespace App\Services;

use InvalidArgumentException;

/**
 * Reads literal rows from the old Workbench dump without executing any SQL.
 *
 * Imported city/facility rows are used only as municipality/province lookup evidence.
 */
final class LegacyCommunityDump
{
    private const array TABLES = ['countries', 'provinces', 'location_status', 'parking_locations', 'parking_rules', 'parking_cities', 'parking_offstreet'];

    /** @return array<string, list<array<string, ?string>>> */
    public function read(string $path): array
    {
        if (! is_file($path) || ! is_readable($path) || filesize($path) > 50 * 1024 * 1024) {
            throw new InvalidArgumentException('Expected a readable SQL dump smaller than 50 MiB.');
        }

        $sql = file_get_contents($path);
        if ($sql === false || ! str_contains(substr($sql, -2000), '-- Dump completed on ')) {
            throw new InvalidArgumentException('The SQL dump has no completion marker.');
        }

        $tables = [];
        foreach (self::TABLES as $table) {
            if (! preg_match('/^CREATE TABLE `'.preg_quote($table, '/').'` \((.*?)\) ENGINE=/ms', $sql, $definition)) {
                if (in_array($table, ['parking_cities', 'parking_offstreet'], true)) {
                    continue;
                }
                throw new InvalidArgumentException("Missing legacy table: {$table}.");
            }

            preg_match_all('/^\s*`([^`]+)`/m', $definition[1], $columns);
            $tables[$table] = [];
            preg_match_all('/^INSERT INTO `'.preg_quote($table, '/').'`/m', $sql, $allInserts);
            preg_match_all('/^INSERT INTO `'.preg_quote($table, '/').'` VALUES /m', $sql, $inserts, PREG_OFFSET_CAPTURE);
            if (count($allInserts[0]) !== count($inserts[0])) {
                throw new InvalidArgumentException("Unsupported INSERT syntax in {$table}.");
            }
            foreach ($inserts[0] as [$header, $offset]) {
                foreach ($this->rows($sql, $offset + strlen($header)) as $values) {
                    if (count($columns[1]) !== count($values)) {
                        throw new InvalidArgumentException("Unexpected column count in {$table}.");
                    }
                    $tables[$table][] = array_combine($columns[1], $values);
                }
            }
        }

        return $tables;
    }

    /** @return list<list<?string>> */
    private function rows(string $sql, int $offset): array
    {
        $rows = [];
        $length = strlen($sql);
        do {
            $this->whitespace($sql, $offset);
            if (($sql[$offset++] ?? '') !== '(') {
                throw new InvalidArgumentException('Expected a literal INSERT row.');
            }
            $values = [];
            do {
                $this->whitespace($sql, $offset);
                if (($sql[$offset] ?? '') === "'") {
                    $offset++;
                    $value = '';
                    $closed = false;
                    while ($offset < $length) {
                        $character = $sql[$offset++];
                        if ($character === '\\') {
                            $escaped = $sql[$offset++] ?? '';
                            $value .= match ($escaped) {
                                'n' => "\n", 'r' => "\r", 't' => "\t", '0' => "\0", 'Z' => "\x1a",
                                '\\', "'", '"' => $escaped,
                                default => throw new InvalidArgumentException('Unsupported SQL string escape.'),
                            };
                        } elseif ($character === "'") {
                            if (($sql[$offset] ?? '') === "'") {
                                $value .= "'";
                                $offset++;
                            } else {
                                $closed = true;
                                break;
                            }
                        } else {
                            $value .= $character;
                        }
                    }
                    if (! $closed) {
                        throw new InvalidArgumentException('Unterminated SQL string.');
                    }
                } else {
                    $start = $offset;
                    while ($offset < $length && ! in_array($sql[$offset], [',', ')'], true)) {
                        $offset++;
                    }
                    $literal = trim(substr($sql, $start, $offset - $start));
                    if ($literal !== 'NULL' && ! preg_match('/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/D', $literal)) {
                        throw new InvalidArgumentException('Only literal SQL values are supported.');
                    }
                    $value = $literal === 'NULL' ? null : $literal;
                }
                $values[] = $value;
                $this->whitespace($sql, $offset);
                $separator = $sql[$offset++] ?? '';
                if (! in_array($separator, [',', ')'], true)) {
                    throw new InvalidArgumentException('Malformed SQL row.');
                }
            } while ($separator === ',');
            $rows[] = $values;
            $this->whitespace($sql, $offset);
            $separator = $sql[$offset++] ?? '';
            if (! in_array($separator, [',', ';'], true)) {
                throw new InvalidArgumentException('Malformed SQL INSERT.');
            }
        } while ($separator === ',');

        return $rows;
    }

    private function whitespace(string $sql, int &$offset): void
    {
        while (isset($sql[$offset]) && ctype_space($sql[$offset])) {
            $offset++;
        }
    }
}
