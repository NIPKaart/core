<?php

namespace App\Services;

use App\Support\MunicipalSnapshot;
use Aws\S3\S3ClientInterface;
use Generator;
use Illuminate\Validation\ValidationException;

class MunicipalDeliveryStorage
{
    public function __construct(private S3ClientInterface $client) {}

    public function bucket(): string
    {
        $bucket = config('filesystems.disks.municipal-deliveries.bucket');
        if (! is_string($bucket) || $bucket === '') {
            throw ValidationException::withMessages(['storage' => 'Municipal delivery bucket is not configured.']);
        }

        return $bucket;
    }

    public function deliveryId(string $key, string $dataset): ?string
    {
        if (! array_key_exists($dataset, config('municipal-deliveries.sources', []))) {
            return null;
        }
        $prefix = preg_quote('municipal/'.$dataset.'/', '/');

        return preg_match('/^'.$prefix.'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.json$/D', $key, $matches) ? $matches[1] : null;
    }

    /** @return Generator<int, array{key: string, etag: string}> */
    public function objects(string $dataset): Generator
    {
        $pages = $this->client->getPaginator('ListObjectsV2', [
            'Bucket' => $this->bucket(), 'Prefix' => 'municipal/'.$dataset.'/',
        ]);
        foreach ($pages as $page) {
            foreach ($page['Contents'] ?? [] as $object) {
                if ($this->deliveryId($object['Key'], $dataset) !== null) {
                    yield ['key' => $object['Key'], 'etag' => $object['ETag']];
                }
            }
        }
    }

    public function read(string $key, string $etag): string
    {
        $result = $this->client->getObject([
            'Bucket' => $this->bucket(), 'Key' => $key, 'IfMatch' => $etag,
            '@http' => ['stream' => true],
        ]);
        $stream = $result['Body'];
        try {
            $length = $result['ContentLength'] ?? 0;
            if ($length < 1 || $length > MunicipalSnapshot::MAX_BYTES) {
                throw ValidationException::withMessages(['file' => 'Delivery size is outside the allowed limit.']);
            }
            $json = '';
            while (! $stream->eof() && strlen($json) <= MunicipalSnapshot::MAX_BYTES) {
                $chunk = $stream->read(min(65536, MunicipalSnapshot::MAX_BYTES + 1 - strlen($json)));
                if ($chunk === '' && ! $stream->eof()) {
                    throw new \RuntimeException('Delivery stream stalled.');
                }
                $json .= $chunk;
            }
            if (strlen($json) < $length) {
                throw new \RuntimeException('Delivery stream ended early.');
            }
            $hash = $result['Metadata']['sha256'] ?? '';
            if (strlen($json) !== $length || ! preg_match('/^[0-9a-f]{64}$/D', $hash) || ! hash_equals($hash, hash('sha256', $json))) {
                throw ValidationException::withMessages(['file' => 'Delivery length or SHA-256 does not match.']);
            }

            return $json;
        } finally {
            $stream->close();
        }
    }
}
