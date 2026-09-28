<?php

namespace App\Services;

use App\Support\MunicipalSnapshot;
use Aws\Exception\AwsException;
use Aws\S3\S3ClientInterface;
use Generator;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class DatasetDeliveryStorage
{
    public function __construct(private S3ClientInterface $client) {}

    public function bucket(): string
    {
        $bucket = config('filesystems.disks.dataset-deliveries.bucket');
        if (! is_string($bucket) || $bucket === '') {
            throw ValidationException::withMessages(['storage' => 'Municipal delivery bucket is not configured.']);
        }

        return $bucket;
    }

    /** Bucket folder per target type; collectors deliver snapshots under these prefixes. */
    public const array PREFIXES = ['municipal' => 'municipal/', 'offstreet' => 'offstreet/'];

    /** Dataset codes are lowercase folder names, such as `nl-amsterdam-garages`. */
    public const string DATASET_PATTERN = '/^[a-z0-9][a-z0-9-]{1,62}$/D';

    public function prefix(string $targetType, string $dataset): ?string
    {
        return isset(self::PREFIXES[$targetType]) && preg_match(self::DATASET_PATTERN, $dataset) ? self::PREFIXES[$targetType].$dataset.'/' : null;
    }

    public function deliveryId(string $key, string $targetType, string $dataset): ?string
    {
        $folder = $this->prefix($targetType, $dataset);
        if ($folder === null) {
            return null;
        }
        $prefix = preg_quote($folder, '/');

        return preg_match('/^'.$prefix.'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.json$/D', $key, $matches) ? $matches[1] : null;
    }

    /**
     * Dataset folders present under a target type's prefix.
     *
     * @return list<string>
     */
    public function datasets(string $targetType): array
    {
        $datasets = [];
        $pages = $this->client->getPaginator('ListObjectsV2', [
            'Bucket' => $this->bucket(), 'Prefix' => self::PREFIXES[$targetType], 'Delimiter' => '/',
        ]);
        foreach ($pages as $page) {
            foreach ($page['CommonPrefixes'] ?? [] as $folder) {
                $dataset = substr(rtrim($folder['Prefix'], '/'), strlen(self::PREFIXES[$targetType]));
                if (preg_match(self::DATASET_PATTERN, $dataset)) {
                    $datasets[] = $dataset;
                }
            }
        }

        return $datasets;
    }

    /** @return Generator<int, array{key: string, etag: string, modified: string}> */
    public function objects(string $targetType, string $dataset): Generator
    {
        $folder = $this->prefix($targetType, $dataset);
        if ($folder === null) {
            return;
        }
        $pages = $this->client->getPaginator('ListObjectsV2', [
            'Bucket' => $this->bucket(), 'Prefix' => $folder,
        ]);
        foreach ($pages as $page) {
            foreach ($page['Contents'] ?? [] as $object) {
                if ($this->deliveryId($object['Key'], $targetType, $dataset) !== null) {
                    yield ['key' => $object['Key'], 'etag' => $object['ETag'], 'modified' => (string) ($object['LastModified'] ?? '')];
                }
            }
        }
    }

    public function archive(string $json, string $targetType, string $dataset, string $deliveryId): void
    {
        $key = $this->prefix($targetType, $dataset).$deliveryId.'.json';
        if ($this->deliveryId($key, $targetType, $dataset) === null) {
            throw ValidationException::withMessages(['file' => 'Deze bron is niet toegestaan voor bucketopslag.']);
        }

        try {
            try {
                $this->client->putObject([
                    'Bucket' => $this->bucket(), 'Key' => $key, 'Body' => $json,
                    'ContentType' => 'application/json', 'IfNoneMatch' => '*',
                    'ContentMD5' => base64_encode(md5($json, true)),
                    'Metadata' => ['sha256' => hash('sha256', $json)],
                ]);
            } catch (AwsException $exception) {
                if ($exception->getStatusCode() !== 412) {
                    throw $exception;
                }
                $head = $this->client->headObject(['Bucket' => $this->bucket(), 'Key' => $key]);
                $existing = $this->read($key, $head['ETag']);
                if (! hash_equals(hash('sha256', $json), hash('sha256', $existing))) {
                    throw ValidationException::withMessages(['file' => 'Deze levering bestaat al in de bucket met andere inhoud. Het bestand is niet overschreven.']);
                }
            }
        } catch (AwsException $exception) {
            Log::warning('Municipal upload archive failed.', ['status' => $exception->getStatusCode(), 'code' => $exception->getAwsErrorCode()]);

            throw ValidationException::withMessages(['file' => 'Het bestand kon niet in de bucket worden opgeslagen. Controleer de verbinding en schrijfrechten en probeer opnieuw.']);
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
