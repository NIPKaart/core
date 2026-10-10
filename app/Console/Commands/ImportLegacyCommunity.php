<?php

namespace App\Console\Commands;

use App\Services\LegacyCommunityDump;
use App\Services\LegacyCommunityImport;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use InvalidArgumentException;

class ImportLegacyCommunity extends Command
{
    protected $signature = 'nipkaart:import-legacy-community {dump : Path to the old Workbench SQL export} {--write : Commit the transfer instead of a read-only preview}';

    protected $description = 'Preview or transfer only legacy community parking places and official rule links';

    public function handle(LegacyCommunityDump $dump, LegacyCommunityImport $import): int
    {
        try {
            $result = $import->run($dump->read($this->argument('dump')), (bool) $this->option('write'));
        } catch (InvalidArgumentException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        } catch (QueryException) {
            $this->error('Database transfer failed and was rolled back. Check target schema and reference-data conflicts.');

            return self::FAILURE;
        }

        $this->info($this->option('write') ? 'Transfer committed.' : 'Read-only preview; no data written.');
        $this->table(['Item', 'Count'], collect($result)->map(fn ($count, $item) => [$item, $count])->values()->all());
        $this->line('Accounts, IP addresses, favorites, contact messages and imported parking feeds are excluded.');

        return self::SUCCESS;
    }
}
