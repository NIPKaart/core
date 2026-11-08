<?php

namespace App\Console\Commands;

use App\Services\DatasetDeliveryService;
use Illuminate\Console\Command;

class DiscoverDatasetDeliveries extends Command
{
    protected $signature = 'nipkaart:discover-deliveries {--full : Reconcile all retained deliveries immediately}';

    protected $description = 'Discover retained dataset deliveries and resume pending intake';

    public function handle(DatasetDeliveryService $service): int
    {
        $service->discover(forceFull: (bool) $this->option('full'));

        return self::SUCCESS;
    }
}
