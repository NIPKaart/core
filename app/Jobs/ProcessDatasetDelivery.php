<?php

namespace App\Jobs;

use App\Services\DatasetDeliveryService;
use Aws\S3\Exception\S3Exception;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ProcessDatasetDelivery implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $timeout = 60;

    public int $tries = 3;

    public int $uniqueFor = 300;

    public int $backoff = 30;

    public function __construct(public int $deliveryId) {}

    public function uniqueId(): string
    {
        return (string) $this->deliveryId;
    }

    public function handle(DatasetDeliveryService $service): void
    {
        $service->process($this->deliveryId);
    }

    public function failed(?Throwable $exception): void
    {
        if ($exception instanceof S3Exception && $exception->getAwsErrorCode() === 'NoSuchKey') {
            app(DatasetDeliveryService::class)->rejectMissingObject($this->deliveryId);
        }
    }
}
