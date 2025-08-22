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
    protected $description = 'Write version to .version';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $version = (string) $this->argument('version');
        file_put_contents(base_path('.version'), $version);

        if ($build = $this->option('build')) {
            $this->line("Build: {$build}");
        }

        $this->info("Wrote .version = {$version}");
        return self::SUCCESS;
    }
}
