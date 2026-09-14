<?php

use App\Services\MunicipalDeliveryStorage;
use Aws\S3\Exception\S3Exception;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

it('round trips immutable deliveries through the local S3 service', function () {
    expect(config('filesystems.disks.municipal-deliveries.endpoint'))->toBe('http://rustfs:9000');
    expect(config('filesystems.disks.municipal-deliveries.bucket'))->toBe('nipkaart-imports');

    $client = Storage::disk('municipal-deliveries')->getClient();
    $storage = app(MunicipalDeliveryStorage::class);
    $dataset = 'nl-amsterdam-parkeervakken-e6a';
    $key = 'municipal/'.$dataset.'/'.Str::uuid().'.json';
    $json = '{"probe":"local-storage"}';
    $object = [
        'Bucket' => $storage->bucket(), 'Key' => $key, 'Body' => $json,
        'ContentType' => 'application/json', 'IfNoneMatch' => '*',
        'ContentMD5' => base64_encode(md5($json, true)),
        'Metadata' => ['sha256' => hash('sha256', $json)],
    ];

    try {
        $client->putObject($object);
        $listed = collect(iterator_to_array($storage->objects($dataset)))->firstWhere('key', $key);
        expect($listed)->not->toBeNull();
        expect($storage->read($key, $listed['etag']))->toBe($json);

        $anonymous = (new Client)->get('http://rustfs:9000/'.$storage->bucket().'/'.$key, ['http_errors' => false, 'timeout' => 10]);
        expect($anonymous->getStatusCode())->toBe(403);

        try {
            $client->putObject($object);
            $this->fail('A repeated conditional PUT must not overwrite the object.');
        } catch (S3Exception $exception) {
            expect($exception->getStatusCode())->toBe(412);
        }
        expect($storage->read($key, $listed['etag']))->toBe($json);

        try {
            $storage->read($key, '"outdated-etag"');
            $this->fail('An outdated ETag must not read replacement bytes.');
        } catch (S3Exception $exception) {
            expect($exception->getStatusCode())->toBe(412);
        }

        $client->putObject(array_replace($object, ['IfNoneMatch' => null, 'Metadata' => ['sha256' => str_repeat('0', 64)]]));
        $etag = $client->headObject(['Bucket' => $storage->bucket(), 'Key' => $key])['ETag'];
        expect(fn () => $storage->read($key, $etag))->toThrow(ValidationException::class);
    } finally {
        $client->deleteObject(['Bucket' => $storage->bucket(), 'Key' => $key]);
    }
})->skip(getenv('RUN_RUSTFS_TESTS') !== '1', 'Run explicitly against DDEV RustFS.');
