<?php

namespace App\Console\Commands;

use App\Services\DatasetDeliveryService;
use Illuminate\Console\Command;

class DiscoverDatasetDeliveries extends Command
{
    protected $signature = 'nipkaart:discover-deliveries';

    protected $description = 'Discover retained municipal deliveries and resume pending intake';

    public function handle(DatasetDeliveryService $service): int
    {
        $service->discover();

        return self::SUCCESS;
    }
}
