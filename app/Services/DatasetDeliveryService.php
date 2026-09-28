<?php

namespace App\Services;

use App\Jobs\ProcessDatasetDelivery;
use App\Models\DatasetDelivery;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DatasetDeliveryService
{
    public function __construct(private DatasetDeliveryStorage $storage, private MunicipalImportService $imports) {}

    public function upload(string $json, User $actor): DatasetImport
    {
        return DB::transaction(function () use ($json, $actor): DatasetImport {
            $import = $this->imports->intake($json, $actor);
            $this->storage->archive($json, $import->datasetSource->code, $import->delivery_id);

            return $import;
        });
    }

    public function discover(): void
    {
        if (! config('dataset-deliveries.enabled')) {
            return;
        }
        $bucket = $this->storage->bucket();
        try {
            foreach (array_keys(config('dataset-deliveries.sources')) as $code) {
                $source = DatasetSource::where('code', $code)->where('target_type', 'municipal')->first();
                if (! $source) {
                    continue;
                }
                foreach ($this->storage->objects($code) as $object) {
                    $delivery = DatasetDelivery::firstOrCreate(
                        ['bucket' => $bucket, 'object_key' => $object['key']],
                        ['dataset_source_id' => $source->id, 'etag' => $object['etag']],
                    );
                    if ($delivery->etag !== $object['etag']) {
                        $delivery->forceFill(['state' => 'rejected', 'error_code' => 'object_changed'])->save();
                    }
                }
            }
        } finally {
            DatasetDelivery::where('bucket', $bucket)->where('state', 'pending')->chunkById(100, function ($deliveries) {
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
            if ($delivery->state !== 'pending') {
                return;
            }
            $source = DatasetSource::findOrFail($delivery->dataset_source_id);
            $deliveryId = $this->storage->deliveryId($delivery->object_key, $source->code);
            if ($delivery->bucket !== $this->storage->bucket() || $deliveryId === null) {
                $delivery->forceFill(['error_code' => 'storage_not_allowed'])->save();

                return;
            }
            try {
                $json = $this->storage->read($delivery->object_key, $delivery->etag);
                $delivery->received_at = now();
                $import = $this->imports->intakeFromStorage($json, $source->code, $deliveryId);
                $delivery->forceFill([
                    'dataset_import_id' => $import->id, 'state' => 'validated',
                    'validated_at' => now(), 'error_code' => null,
                    'late_on_receipt' => $import->retrieved_at->lt(now()->subHours(config('dataset-deliveries.sources.'.$source->code.'.max_age_hours'))),
                ])->save();
            } catch (ValidationException) {
                $delivery->forceFill(['state' => 'rejected', 'error_code' => 'invalid_delivery'])->save();
            }
        });
    }
}
