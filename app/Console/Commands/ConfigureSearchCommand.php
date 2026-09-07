<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Meilisearch\Client;

class ConfigureSearchCommand extends Command
{
    protected $signature = 'search:configure';

    protected $description = 'Create/update the parking indexes and wait for their settings to be applied';

    public function handle(Client $client): int
    {
        foreach (config('scout.meilisearch.index-settings') as $model => $settings) {
            $name = (new $model)->searchableAs();
            // Updating settings also creates a missing index. No documents are deleted.
            $task = $client->index($name)->updateSettings($settings);
            $result = $client->waitForTask($task['taskUid'], 120000);

            if ($result['status'] !== 'succeeded') {
                $this->error('Settings failed for '.$name.': '.json_encode($result['error'] ?? $result));

                return self::FAILURE;
            }

            $this->info('Configured '.$name);
        }

        return self::SUCCESS;
    }
}
