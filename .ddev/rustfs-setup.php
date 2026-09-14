<?php

use Aws\S3\Exception\S3Exception;
use Aws\S3\S3Client;

require __DIR__.'/../vendor/autoload.php';

$client = new S3Client([
    'version' => 'latest',
    'region' => 'auto',
    'endpoint' => 'http://rustfs:9000',
    'credentials' => ['key' => 'ddevrustfs', 'secret' => 'ddevrustfs'],
    'use_path_style_endpoint' => true,
    'http' => ['connect_timeout' => 5, 'timeout' => 20],
]);

try {
    $client->createBucket(['Bucket' => 'nipkaart-imports']);
} catch (S3Exception $exception) {
    if ($exception->getAwsErrorCode() !== 'BucketAlreadyOwnedByYou') {
        throw $exception;
    }
}

echo "Local RustFS bucket nipkaart-imports is ready.\n";
