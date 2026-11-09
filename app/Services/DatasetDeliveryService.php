<?php

namespace App\Services;

use App\Events\DatasetDataChanged;
use App\Jobs\ProcessDatasetDelivery;
use App\Models\DatasetDelivery;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\User;
use App\Support\LocationProposalSnapshot;
use App\Support\SourceDescription;
use Aws\Exception\AwsException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class DatasetDeliveryService
{
    public function __construct(
        private DatasetDeliveryStorage $storage,
        private DatasetImports $imports,
        private SourceRegistrar $registrar,
        private MunicipalProvenance $provenance,
        private DatasetDeliveryNotifications $notifications,
        private LocationProposalIntake $proposals,
    ) {}

    public function upload(string $json, User $actor): DatasetImport
    {
        return DB::transaction(function () use ($json, $actor): DatasetImport {
            $import = $this->imports->forUpload($json)->intake($json, $actor, automatic: true);
            $source = $import->datasetSource;
            $this->storage->archive($json, $source->target_type, $source->code, $import->delivery_id);

            return $import;
        });
    }

    /**
     * Records every delivery in the bucket. Unknown dataset folders become sources awaiting approval
     * (ADR 0013); only deliveries of approved sources are processed.
     */
    public function discover(bool $forceFull = false): void
    {
        if (! config('dataset-deliveries.enabled')) {
            return;
        }
        $bucket = $this->storage->bucket();
        $incremental = $this->notifications->configured();
        $checkpoint = 'dataset-deliveries.full-scan.'.hash('sha256', $bucket);
        $full = $forceFull || ! $incremental || ! Cache::has($checkpoint);
        $messages = [];
        $received = [];
        try {
            if ($full) {
                foreach (array_keys(DatasetDeliveryStorage::PREFIXES) as $type) {
                    foreach ($this->storage->datasets($type) as $code) {
                        $this->scanFolder($bucket, $type, $code, null, $received);
                    }
                }
            } else {
                $messages = $this->notifications->pull();
                foreach ($this->notifiedObjects($bucket, $messages) as $type => $folders) {
                    foreach ($folders as $code => $keys) {
                        $this->scanFolder($bucket, $type, $code, array_keys($keys), $received);
                    }
                }
            }
        } finally {
            foreach (array_keys($received) as $type) {
                DatasetDataChanged::dispatch('deliveries', $type);
            }
            DatasetDelivery::where('bucket', $bucket)->where('state', 'pending')
                ->whereIn('dataset_source_id', DatasetSource::where('approval_state', 'approved')->select('id'))
                ->chunkById(100, function ($deliveries) {
                    foreach ($deliveries as $delivery) {
                        ProcessDatasetDelivery::dispatch($delivery->id)->afterCommit();
                    }
                });
        }

        if ($full && $incremental) {
            Cache::put($checkpoint, true, now()->addHour());
        }
        $this->notifications->acknowledge($messages);
    }

    private function notifiedObjects(string $bucket, array $messages): array
    {
        $folders = [];
        foreach ($messages as $message) {
            $body = $message['body'] ?? null;
            if (is_string($body)) {
                $decoded = json_decode($body, true);
                if ($decoded === null && in_array($message['metadata']['CF-Content-Type'] ?? null, ['json', 'bytes'], true)) {
                    $decoded = json_decode(base64_decode($body, true) ?: '', true);
                }
                $body = $decoded;
            }
            $key = $body['object']['key'] ?? null;
            if (($body['bucket'] ?? null) !== $bucket || ! is_string($key)) {
                continue;
            }
            [$type, $code] = array_pad(explode('/', $key, 3), 2, '');
            if ($this->storage->deliveryId($key, $type, $code) !== null) {
                $folders[$type][$code][$key] = true;
            }
        }

        return $folders;
    }

    /** @param list<string>|null $keys Null requests a full listing. */
    private function scanFolder(string $bucket, string $type, string $code, ?array $keys, array &$received): void
    {
        $source = DatasetSource::where('code', $code)->first();
        // A new source still takes its description from the newest delivery in the folder.
        if ($keys === null || $source === null) {
            $objects = iterator_to_array($this->storage->objects($type, $code), false);
            $source ??= $this->registerFrom($type, $objects);
        } else {
            $objects = iterator_to_array($this->storage->currentObjects($keys), false);
        }
        if (! $source || $source->target_type !== $type) {
            return;
        }
        foreach (array_chunk($objects, 500) as $batch) {
            $existing = DatasetDelivery::where('bucket', $bucket)
                ->whereIn('object_key', array_column($batch, 'key'))
                ->get()
                ->keyBy('object_key');

            foreach ($batch as $object) {
                $delivery = $existing->get($object['key']) ?? DatasetDelivery::firstOrCreate(
                    ['bucket' => $bucket, 'object_key' => $object['key']],
                    ['dataset_source_id' => $source->id, 'etag' => $object['etag']],
                );
                if ($delivery->wasRecentlyCreated) {
                    $received[$type] = true;
                }
                if ($delivery->etag !== $object['etag']) {
                    $delivery->forceFill(['state' => 'rejected', 'error_code' => 'object_changed'])->save();
                }
            }
        }
    }

    public function process(int $id): void
    {
        if (! config('dataset-deliveries.enabled')) {
            return;
        }
        DB::transaction(function () use ($id) {
            $delivery = DatasetDelivery::whereKey($id)->lockForUpdate()->firstOrFail();
            $source = DatasetSource::findOrFail($delivery->dataset_source_id);
            if ($source->target_type === 'proposals') {
                $source = DatasetSource::whereKey($source->id)->lockForUpdate()->firstOrFail();
            }
            if ($delivery->state !== 'pending' || ! $source->isApproved()) {
                return;
            }
            $deliveryId = $this->storage->deliveryId($delivery->object_key, $source->target_type, $source->code);
            if ($delivery->bucket !== $this->storage->bucket() || $deliveryId === null) {
                $delivery->forceFill(['error_code' => 'storage_not_allowed'])->save();

                return;
            }
            try {
                $json = $this->storage->read($delivery->object_key, $delivery->etag);
                $proposal = $source->target_type === 'proposals';
                $snapshot = $proposal ? LocationProposalSnapshot::envelope($json) : null;
                $importer = $proposal ? null : $this->imports->forSource($source);
                $data = $snapshot['data'] ?? $importer->decodeDelivery($json);
                if ($proposal && ($data['dataset'] !== $source->code || $data['delivery_id'] !== $deliveryId || $data['selection'] !== $source->selection)) {
                    throw ValidationException::withMessages(['file' => 'Location proposal delivery does not match the registered source or object key.']);
                }
                $staleProposal = $proposal && $source->last_proposal_retrieved_at?->gte($data['retrieved_at']);
                if (! $staleProposal && SourceDescription::approvalFingerprint($data['source']) !== SourceDescription::approvalFingerprint($source->description)) {
                    if ($proposal) {
                        $this->validateProposalPoints($json, $snapshot);
                    }
                    // The delivery waits until an administrator approves the changed description.
                    $this->registrar->holdForReapproval($source, $data['source']);

                    return;
                }
                if ($proposal) {
                    $this->proposals->apply($source, $json, $snapshot);
                }
                if (! $staleProposal && $data['source']['expected_interval_hours'] !== $source->expected_interval_hours) {
                    $source->forceFill(['expected_interval_hours' => $data['source']['expected_interval_hours'], 'description' => $data['source']])->save();
                }
                $delivery->received_at = now();
                $import = $importer?->intakeFromStorage($json, $source->code, $deliveryId);
                $retrievedAt = $import?->retrieved_at ?? $data['retrieved_at'];
                $lateAfter = $this->provenance->lateAfterHours($source);
                $delivery->forceFill([
                    'dataset_import_id' => $import?->id, 'proposal_retrieved_at' => $proposal ? $retrievedAt : null, 'state' => 'validated',
                    'validated_at' => now(), 'error_code' => null,
                    'late_on_receipt' => $lateAfter !== null && $retrievedAt->lt(now()->subHours($lateAfter)),
                ])->save();
            } catch (ValidationException) {
                $delivery->forceFill(['state' => 'rejected', 'error_code' => 'invalid_delivery'])->save();
            }
            DatasetDataChanged::dispatch('deliveries', $source->target_type);
        });
    }

    public function rejectMissingObject(int $id): void
    {
        DB::transaction(function () use ($id) {
            $delivery = DatasetDelivery::whereKey($id)->lockForUpdate()->first();
            if ($delivery === null || $delivery->state !== 'pending') {
                return;
            }

            $delivery->forceFill(['state' => 'rejected', 'error_code' => 'object_missing'])->save();
            $source = DatasetSource::findOrFail($delivery->dataset_source_id);
            DatasetDataChanged::dispatch('deliveries', $source->target_type);
        });
    }

    /**
     * Registers a new source from the newest delivery in its folder. An unreadable or invalid newest
     * delivery registers nothing; the next discovery tries again.
     *
     * @param  list<array{key: string, etag: string, modified: string}>  $objects
     */
    private function registerFrom(string $type, array $objects): ?DatasetSource
    {
        if ($objects === []) {
            return null;
        }
        usort($objects, fn (array $a, array $b) => strcmp($b['modified'], $a['modified']));
        try {
            $json = $this->storage->read($objects[0]['key'], $objects[0]['etag']);
            if ($type === 'proposals') {
                $snapshot = LocationProposalSnapshot::envelope($json);
                $data = $snapshot['data'];
                $this->validateProposalPoints($json, $snapshot);
            } else {
                $data = $this->imports->forTarget($type)->decodeDelivery($json);
            }
        } catch (ValidationException|AwsException $exception) {
            Log::warning('Dataset source could not be registered from its newest delivery.', ['key' => $objects[0]['key'], 'exception' => $exception::class]);

            return null;
        }
        $folder = $this->storage->prefix($type, $data['dataset']);
        if ($folder === null || ! str_starts_with($objects[0]['key'], $folder)
            || ($type === 'proposals' && $this->storage->deliveryId($objects[0]['key'], $type, $data['dataset']) !== $data['delivery_id'])) {
            return null;
        }

        return $this->registrar->register($type, $data);
    }

    private function validateProposalPoints(string $json, array $snapshot): void
    {
        foreach (LocationProposalSnapshot::points($json, $snapshot['recordsOffset'], $snapshot['data']) as $_point) {
            // Exhaust validation without retaining the point records.
        }
    }
}
