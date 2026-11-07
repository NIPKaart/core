<?php

namespace App\Console\Commands;

use App\Services\GeographicReferenceCatalog;
use Illuminate\Console\Command;

class SyncGeographicReference extends Command
{
    protected $signature = 'nipkaart:sync-geographic-reference';

    protected $description = 'Add missing countries and subdivisions from the geographic reference catalog';

    public function handle(GeographicReferenceCatalog $catalog): int
    {
        $catalog->sync();
        $this->info('Geographic reference catalog synchronized.');

        return self::SUCCESS;
    }
}
