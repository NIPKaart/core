<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

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

if (config('dataset-deliveries.enabled')) {
    Schedule::command('nipkaart:discover-deliveries')->everyFiveMinutes()->onOneServer()->withoutOverlapping(10);
    // The collector delivers observations every two minutes; only the newest unprocessed one is applied.
    Schedule::command('nipkaart:ingest-observations')->everyMinute()->onOneServer()->withoutOverlapping(5);
}

// Official parking-rule links are checked once a day; a failing link is reported to admins, never hidden or replaced.
Schedule::command('nipkaart:check-rule-links')->dailyAt('04:15')->timezone('UTC')->environments(['production'])->onOneServer()->withoutOverlapping(60);
