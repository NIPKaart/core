<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Validates `nipkaart-offstreet-observations-2` deliveries: what the operator reports per facility at a moment, passed on unchanged.
 * Core decides freshness; `null` stays unknown. General free spaces never imply free accessible bays (#1221).
 */
final class OffstreetObservations
{
    public const string FORMAT = 'nipkaart-offstreet-observations-2';

    private const array FIELDS = ['external_id', 'observed_at', 'source_state', 'status', 'capacity', 'available'];

    /** Operator status next to the count: status-only sites report open or full, and a closed site also reports zero free. */
    public const array STATUSES = ['counting', 'open', 'full', 'closed', 'malfunction'];

    private const array COUNTS = ['capacity', 'available'];

    private const string TIMESTAMP = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/';

    /** Source clocks may run slightly ahead; later measurement times are rejected. */
    private const int CLOCK_SKEW_MINUTES = 5;

    /**
     * @return array{dataset: string, selection: string, delivery_id: string, fetched_at: CarbonImmutable, records: list<array{external_id: string, observed_at: ?CarbonImmutable, source_state: ?string, status: ?string, capacity: ?int, available: ?int}>}
     */
    public function decode(string $json): array
    {
        [$data] = SnapshotJson::decode($json);
        Validator::make($data, [
            'format' => ['required', 'in:'.self::FORMAT],
            'dataset' => ['required', 'string', 'max:255'],
            'selection' => ['required', 'string', 'max:255'],
            'delivery_id' => ['required', 'uuid'],
            'fetched_at' => ['required', 'string', 'regex:'.self::TIMESTAMP, 'date'],
            'source_count' => ['required', 'integer'],
            'records' => ['required', 'array', 'list', 'min:1', 'max:10000'],
        ])->validate();
        if ($data['source_count'] !== count($data['records'])) {
            $this->fail('source_count', 'Het bronaantal komt niet overeen met het aantal metingen.');
        }
        $fetchedAt = CarbonImmutable::parse($data['fetched_at']);
        if ($fetchedAt->isAfter(now()->addMinutes(self::CLOCK_SKEW_MINUTES))) {
            $this->fail('fetched_at', 'Het ophaaltijdstip ligt in de toekomst.');
        }
        $seen = [];
        $records = [];
        foreach ($data['records'] as $index => $record) {
            $prefix = "records.$index";
            if (! is_array($record) || array_diff(array_keys($record), self::FIELDS) !== [] || array_diff(self::FIELDS, array_keys($record)) !== []) {
                $this->fail($prefix, 'Onverwachte of ontbrekende meetvelden.');
            }
            $id = $record['external_id'];
            if (! is_string($id) || $id === '' || $id !== trim($id) || mb_strlen($id) > 255 || isset($seen[$id])) {
                $this->fail("$prefix.external_id", 'Bron-ID is ongeldig of dubbel.');
            }
            $seen[$id] = true;
            $observedAt = $record['observed_at'];
            if ($observedAt !== null && (! is_string($observedAt) || ! preg_match(self::TIMESTAMP, $observedAt) || strtotime($observedAt) === false)) {
                $this->fail("$prefix.observed_at", 'Verwacht een UTC-tijdstip of null.');
            }
            $observedAt = $observedAt === null ? null : CarbonImmutable::parse($observedAt);
            if ($observedAt?->isAfter($fetchedAt->addMinutes(self::CLOCK_SKEW_MINUTES))) {
                $this->fail("$prefix.observed_at", 'De meettijd ligt na het ophaaltijdstip.');
            }
            if (! in_array($record['source_state'], ['ok', 'error', null], true)) {
                $this->fail("$prefix.source_state", 'Onbekende bronstatus.');
            }
            if ($record['status'] !== null && ! in_array($record['status'], self::STATUSES, true)) {
                $this->fail("$prefix.status", 'Onbekende exploitantstatus.');
            }
            foreach (self::COUNTS as $field) {
                if ($record[$field] !== null && (! is_int($record[$field]) || $record[$field] < 0 || $record[$field] > 2147483647)) {
                    $this->fail("$prefix.$field", 'Verwacht een geheel aantal of null; onbekend blijft null.');
                }
            }
            $records[] = [...$record, 'observed_at' => $observedAt];
        }

        return [
            'dataset' => $data['dataset'], 'selection' => $data['selection'], 'delivery_id' => $data['delivery_id'],
            'fetched_at' => $fetchedAt, 'records' => $records,
        ];
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
