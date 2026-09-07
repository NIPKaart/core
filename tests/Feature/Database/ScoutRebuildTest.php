<?php

use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use Illuminate\Support\Facades\Artisan;
use Meilisearch\Client;
use Meilisearch\Exceptions\ApiException;

it('rebuilds all search indexes from PostgreSQL after removing derived documents', function () {
    if (! filter_var(env('MEILISEARCH_REHEARSAL', false), FILTER_VALIDATE_BOOLEAN)) {
        $this->markTestSkipped('Enable MEILISEARCH_REHEARSAL only with a disposable Meilisearch server.');
    }

    $point = ['latitude' => 52.37, 'longitude' => 4.9];
    $models = [
        ParkingSpace::factory()->create([...$point, 'status' => 'approved']),
        ParkingMunicipal::factory()->create([...$point, 'visibility' => true]),
        ParkingOffstreet::factory()->create([...$point, 'visibility' => true]),
    ];
    ParkingSpace::factory()->create([...$point, 'status' => 'pending']);
    ParkingMunicipal::factory()->create([...$point, 'visibility' => false]);
    ParkingOffstreet::factory()->create([...$point, 'visibility' => false]);

    config()->set(['scout.driver' => 'meilisearch', 'scout.queue' => false]);
    $client = new Client(config('scout.meilisearch.host'), config('scout.meilisearch.key'));

    foreach ($models as $model) {
        $index = $client->index($model->searchableAs());
        try {
            $client->getIndex($model->searchableAs());
            $task = $index->deleteAllDocuments();
            expect($client->waitForTask($task['taskUid'], 30000)['status'])->toBe('succeeded');
        } catch (ApiException $exception) {
            if ($exception->getCode() !== 404) {
                throw $exception;
            }
        }
        // Recreate from PostgreSQL twice; Meilisearch is never the source of data.
        for ($run = 0; $run < 2; $run++) {
            if ($run > 0) {
                $task = $index->deleteAllDocuments();
                expect($client->waitForTask($task['taskUid'], 30000)['status'])->toBe('succeeded');
            }
            expect(Artisan::call('scout:import', ['model' => $model::class]))->toBe(0);
            foreach ($index->getTasks()->getResults() as $task) {
                expect($client->waitForTask($task['uid'], 30000)['status'])->toBe('succeeded');
            }
            $documents = $index->getDocuments()->getResults();
            expect($documents)->toHaveCount(1)
                ->and((string) $documents[0]['id'])->toBe($model->id)
                ->and($documents[0]['_geo'])->toBe(['lat' => 52.37, 'lng' => 4.9]);
        }
    }
});
