<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('backup:run-encrypted', function (): int {
    if (blank(config('backup.backup.password'))) {
        $this->error('BACKUP_ARCHIVE_PASSWORD must be configured before database backups can run.');

        return 1;
    }

    return $this->call('backup:run', ['--only-db' => true]);
})->purpose('Create an encrypted database backup');

if (config('backup.enabled')) {
    foreach (['backup:run-encrypted' => '01:30', 'backup:monitor' => '03:00', 'backup:clean' => '03:30'] as $command => $time) {
        Schedule::command($command)
            ->dailyAt($time)
            ->timezone('UTC')
            ->environments(['production'])
            ->onOneServer()
            ->withoutOverlapping(180);
    }
}
