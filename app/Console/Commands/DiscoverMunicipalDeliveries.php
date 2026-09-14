<?php

namespace App\Console\Commands;

use App\Services\MunicipalDeliveryService;
use Illuminate\Console\Command;

class DiscoverMunicipalDeliveries extends Command
{
    protected $signature = 'nipkaart:discover-municipal-deliveries';

    protected $description = 'Discover retained municipal deliveries and resume pending intake';

    public function handle(MunicipalDeliveryService $service): int
    {
        $service->discover();

        return self::SUCCESS;
    }
}
