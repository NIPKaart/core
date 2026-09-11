<?php

namespace App\Support;

use Closure;
use JsonException;
use Opis\JsonSchema\Validator;
use stdClass;

/** A bounded, local contract check; it does not authorize or publish imports. */
final class SnapshotContract
{
    public const int MAX_MANIFEST_BYTES = 16384;

    public const int MAX_ARTIFACT_BYTES = 33554432;

    public const int MAX_LINE_BYTES = 16384;

    public const int MAX_RECORDS = 10000;

    public const float MAX_VALIDATION_SECONDS = 30;

    private Validator $validator;

    private stdClass $manifestSchema;

    private stdClass $recordSchema;

    private Closure $clock;

    public function __construct(?Closure $clock = null)
    {
        $this->clock = $clock ?? static fn (): float => hrtime(true) / 1e9;
        $this->validator = new Validator;
        $directory = dirname(__DIR__, 2).'/resources/schemas/import/v1/';
        $this->manifestSchema = json_decode(file_get_contents($directory.'manifest.schema.json'), false, 32, JSON_THROW_ON_ERROR);
        $this->recordSchema = json_decode(file_get_contents($directory.'municipal-record.schema.json'), false, 32, JSON_THROW_ON_ERROR);
    }

    /**
     * Context is trusted admission/ledger state supplied by the consumer, never by the manifest.
     *
     * @param  array{source_id: string, scope_version: int, source_config_version: int, country_code: string, bounds: array{float, float, float, float}, highest_sequence: int, batches: array<string, string>, sequences: array<int, string>}  $context
     */
    public function check(string $manifestJson, string $recordsPath, array $context): string
    {
        $started = ($this->clock)();
        if (strlen($manifestJson) > self::MAX_MANIFEST_BYTES) {
            return 'invalid';
        }

        try {
            $manifest = json_decode($manifestJson, false, 32, JSON_THROW_ON_ERROR);
            if (! $this->validator->validate($manifest, $this->manifestSchema)->isValid()) {
                return 'invalid';
            }

            $expectedKey = "sources/{$manifest->source_id}/batches/{$manifest->batch_id}/records.jsonl";
            $completeness = $manifest->completeness;
            if ($manifest->source_id !== $context['source_id']
                || $manifest->artifact->key !== $expectedKey
                || $manifest->fetched_finished_at < $manifest->fetched_started_at
                || strtotime($manifest->fetched_finished_at) - strtotime($manifest->fetched_started_at) > 1800
                || $completeness->records_seen != $completeness->records_emitted + $completeness->records_filtered_out
                || $completeness->records_emitted != $manifest->artifact->record_count
                || ($completeness->expected_records !== null && $completeness->expected_records != $completeness->records_seen)) {
                return 'invalid';
            }

            if (! is_file($recordsPath) || ! is_readable($recordsPath)) {
                return 'invalid';
            }
            $stream = fopen($recordsPath, 'rb');
            if ($stream === false) {
                return 'invalid';
            }
            $hash = hash_init('sha256');
            $bytes = 0;
            $ids = [];
            $review = false;
            try {
                while (($line = fgets($stream, self::MAX_LINE_BYTES + 2)) !== false) {
                    $bytes += strlen($line);
                    if ($bytes > self::MAX_ARTIFACT_BYTES || strlen($line) > self::MAX_LINE_BYTES
                        || ! str_ends_with($line, "\n") || str_contains($line, "\r")
                        || (($this->clock)() - $started) > self::MAX_VALIDATION_SECONDS) {
                        return 'invalid';
                    }
                    hash_update($hash, $line);
                    $record = json_decode($line, false, 32, JSON_THROW_ON_ERROR);
                    if (! $this->validator->validate($record, $this->recordSchema)->isValid()) {
                        return 'invalid';
                    }
                    $id = 'id:'.$record->external_id;
                    if (isset($ids[$id]) || count($ids) >= self::MAX_RECORDS) {
                        return 'invalid';
                    }
                    $ids[$id] = true;
                    [$west, $south, $east, $north] = $context['bounds'];
                    if ($record->country_code !== $context['country_code']
                        || $record->position->longitude < $west || $record->position->longitude > $east
                        || $record->position->latitude < $south || $record->position->latitude > $north) {
                        return 'invalid';
                    }
                    $review = $review || $record->access_category !== 'designated_accessible'
                        || $record->unmapped_fields !== [] || $record->restrictions !== [];
                }
                if (! feof($stream)) {
                    return 'invalid';
                }
            } finally {
                fclose($stream);
            }
            if ($bytes != $manifest->artifact->bytes || count($ids) != $manifest->artifact->record_count
                || hash_final($hash) !== $manifest->artifact->sha256
                || (($this->clock)() - $started) > self::MAX_VALIDATION_SECONDS) {
                return 'invalid';
            }

            $knownHash = $context['batches'][$manifest->batch_id] ?? null;
            if ($knownHash !== null) {
                return hash_equals($knownHash, hash('sha256', $manifestJson)) ? 'duplicate' : 'conflict';
            }
            if (isset($context['sequences'][$manifest->source_sequence])) {
                return 'conflict';
            }
            if ($manifest->source_sequence <= $context['highest_sequence']) {
                return 'superseded';
            }
            if ($review || $ids === [] || $manifest->scope_version != $context['scope_version']
                || $manifest->source_config_version != $context['source_config_version']) {
                return 'review';
            }

            return 'valid';
        } catch (JsonException) {
            return 'invalid';
        }
    }
}
