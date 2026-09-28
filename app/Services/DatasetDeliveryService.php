<?php

namespace App\Services;

use App\Jobs\ProcessDatasetDelivery;
use App\Models\DatasetDelivery;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\User;
use App\Support\SourceDescription;
use Aws\Exception\AwsException;
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
    ) {}

    public function upload(string $json, User $actor): DatasetImport
    {
        return DB::transaction(function () use ($json, $actor): DatasetImport {
            $import = $this->imports->forUpload($json)->intake($json, $actor);
            $source = $import->datasetSource;
            $this->storage->archive($json, $source->target_type, $source->code, $import->delivery_id);

            return $import;
        });
    }

    /**
     * Records every delivery in the bucket. Unknown dataset folders become sources awaiting approval
     * (ADR 0013); only deliveries of approved sources are processed.
     */
    public function discover(): void
    {
        if (! config('dataset-deliveries.enabled')) {
            return;
        }
        $bucket = $this->storage->bucket();
        try {
            foreach (array_keys(DatasetDeliveryStorage::PREFIXES) as $type) {
                foreach ($this->storage->datasets($type) as $code) {
                    $objects = iterator_to_array($this->storage->objects($type, $code), false);
                    $source = DatasetSource::where('code', $code)->first() ?? $this->registerFrom($type, $objects);
                    if (! $source || $source->target_type !== $type) {
                        continue;
                    }
                    foreach ($objects as $object) {
                        $delivery = DatasetDelivery::firstOrCreate(
                            ['bucket' => $bucket, 'object_key' => $object['key']],
                            ['dataset_source_id' => $source->id, 'etag' => $object['etag']],
                        );
                        if ($delivery->etag !== $object['etag']) {
                            $delivery->forceFill(['state' => 'rejected', 'error_code' => 'object_changed'])->save();
                        }
                    }
                }
            }
        } finally {
            DatasetDelivery::where('bucket', $bucket)->where('state', 'pending')
                ->whereIn('dataset_source_id', DatasetSource::where('approval_state', 'approved')->select('id'))
                ->chunkById(100, function ($deliveries) {
                    foreach ($deliveries as $delivery) {
                        ProcessDatasetDelivery::dispatch($delivery->id)->afterCommit();
                    }
                });
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
                $importer = $this->imports->forSource($source);
                $data = $importer->decodeDelivery($json);
                if (SourceDescription::approvalFingerprint($data['source']) !== SourceDescription::approvalFingerprint($source->description)) {
                    // The delivery waits until an administrator approves the changed description.
                    $this->registrar->holdForReapproval($source, $data['source']);

                    return;
                }
                if ($data['source']['expected_interval_hours'] !== $source->expected_interval_hours) {
                    $source->forceFill(['expected_interval_hours' => $data['source']['expected_interval_hours'], 'description' => $data['source']])->save();
                }
                $delivery->received_at = now();
                $import = $importer->intakeFromStorage($json, $source->code, $deliveryId);
                $lateAfter = $this->provenance->lateAfterHours($source);
                $delivery->forceFill([
                    'dataset_import_id' => $import->id, 'state' => 'validated',
                    'validated_at' => now(), 'error_code' => null,
                    'late_on_receipt' => $lateAfter !== null && $import->retrieved_at->lt(now()->subHours($lateAfter)),
                ])->save();
            } catch (ValidationException) {
                $delivery->forceFill(['state' => 'rejected', 'error_code' => 'invalid_delivery'])->save();
            }
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
            $data = $this->imports->forTarget($type)->decodeDelivery($this->storage->read($objects[0]['key'], $objects[0]['etag']));
        } catch (ValidationException|AwsException $exception) {
            Log::warning('Dataset source could not be registered from its newest delivery.', ['key' => $objects[0]['key'], 'exception' => $exception::class]);

            return null;
        }
        $folder = $this->storage->prefix($type, $data['dataset']);
        if ($folder === null || ! str_starts_with($objects[0]['key'], $folder)) {
            return null;
        }

        return $this->registrar->register($type, $data);
    }
}
