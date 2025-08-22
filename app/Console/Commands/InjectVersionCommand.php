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
    protected $signature = 'app:inject-version {version} {--build=}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Write version to .version and (optionally) cache config';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $version = (string) $this->argument('version');
        $build = (string) ($this->option('build') ?? '');

        file_put_contents(base_path('.version'), $version);

        $this->callSilently('config:clear');
        $this->callSilently('config:cache');

        $this->info("Wrote .version = {$version}".($build ? " (build: {$build})" : ''));

        return self::SUCCESS;
    }
}
