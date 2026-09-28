<?php

namespace App\Console\Commands;

use App\Services\OffstreetObservationService;
use Illuminate\Console\Command;

class IngestOffstreetObservations extends Command
{
    protected $signature = 'nipkaart:ingest-observations';

    protected $description = 'Apply the newest live occupancy observations of approved offstreet sources';

    public function handle(OffstreetObservationService $service): int
    {
        foreach ($service->ingest() as $code => $result) {
            $this->line($result === null ? "$code: no new observations" : "$code: {$result['applied']} applied, {$result['unknown']} unknown facilities");
        }

        return self::SUCCESS;
    }
}
