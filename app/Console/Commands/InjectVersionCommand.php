<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class InjectVersionCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:inject-version {version}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Write version to .version';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $version = (string) $this->argument('version');
        $result = file_put_contents(base_path('.version'), $version);
        if ($result === false) {
            $this->error('Failed to write to .version file.');

            return self::FAILURE;
        }

        $this->info("Wrote .version = {$version}");

        return self::SUCCESS;
    }
}
