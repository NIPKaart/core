<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class ClearLogsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'logs:clear';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clear all server logs';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $logPath = storage_path('logs/laravel.log');

        if (!File::exists($logPath)) {
            $this->info('Log file does not exist.');
            return Command::SUCCESS;
        }

        File::put($logPath, '');

        $this->info('Log file cleared successfully.');
        return Command::SUCCESS;
    }
}
