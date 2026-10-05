<?php

// Run with: ddev exec php scripts/rehearse-restore.php
// Restore rehearsal (#1261): backs up the current local database with the production backup command, restores the
// encrypted archive into a separate database and compares the two. The source database is only read; the restored
// database, archive and decrypted dump are removed afterwards. Record the printed summary in docs.
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

if (! $app->environment('local') || ! is_dir('/mnt/ddev_config')) {
    throw new RuntimeException('This restore rehearsal must run inside local DDEV.');
}

$source = config('database.connections.pgsql.database');
$id = 'rehearsal_'.bin2hex(random_bytes(6));
$target = $id.'_restore';
$directory = sys_get_temp_dir().'/'.$id;
mkdir($directory, 0700);
$password = bin2hex(random_bytes(24));
$run = function (array $arguments): string {
    $process = new Process($arguments, null, ['PGPASSWORD' => 'db']);
    $process->setTimeout(600);
    $process->mustRun();

    return $process->getOutput();
};
$query = fn (string $database, string $sql): string => trim($run(['psql', '-h', 'db', '-U', 'db', '-d', $database, '-tAc', $sql]));

// Every public table's exact row count, the extensions, invalid constraints and two checks of derived data.
$inspect = function (string $database) use ($query): array {
    $tables = array_filter(explode("\n", $query($database, "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")));
    $counts = [];
    foreach ($tables as $table) {
        $counts[$table] = (int) $query($database, 'SELECT count(*) FROM public."'.$table.'"');
    }

    return [
        'counts' => $counts,
        'extensions' => $query($database, "SELECT string_agg(extname, ',' ORDER BY extname) FROM pg_extension WHERE extname IN ('postgis', 'pg_trgm')"),
        'invalid_constraints' => (int) $query($database, 'SELECT count(*) FROM pg_constraint WHERE NOT convalidated'),
        'location_checksum' => $query($database, 'SELECT coalesce(round(sum(ST_X(location::geometry) + ST_Y(location::geometry))::numeric, 6), 0) FROM parking_spaces'),
        'trigram_matches' => $query($database, "SELECT count(*) FROM parking_spaces WHERE street % 'Kerkstraat'"),
    ];
};

config([
    'filesystems.disks.backups' => ['driver' => 'local', 'root' => $directory.'/archives', 'throw' => true],
    'backup.backup.password' => $password,
    'backup.backup.temporary_directory' => $directory.'/temporary',
    'backup.notifications.notifications' => array_map(fn () => [], config('backup.notifications.notifications')),
]);

try {
    $before = $inspect($source);

    $started = microtime(true);
    if (Artisan::call('backup:run-encrypted') !== 0) {
        throw new RuntimeException(Artisan::output());
    }
    $backupSeconds = microtime(true) - $started;
    $archives = File::allFiles($directory.'/archives');
    if (count($archives) !== 1) {
        throw new RuntimeException('Expected one backup archive.');
    }
    $archive = $archives[0];

    $started = microtime(true);
    $zip = new ZipArchive;
    if ($zip->open($archive->getPathname()) !== true) {
        throw new RuntimeException('Cannot open backup.');
    }
    $zip->setPassword($password);
    $sql = null;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        if (str_ends_with($zip->getNameIndex($i), '.sql')) {
            if (($zip->statIndex($i)['encryption_method'] ?? 0) !== ZipArchive::EM_AES_256) {
                throw new RuntimeException('Database dump is not AES-256 encrypted.');
            }
            $sql = $zip->getFromIndex($i);
        }
    }
    $zip->close();
    if (! is_string($sql)) {
        throw new RuntimeException('Encrypted SQL dump could not be read.');
    }
    file_put_contents($directory.'/restore.sql', $sql);
    unset($sql);
    $run(['createdb', '-h', 'db', '-U', 'db', $target]);
    $run(['psql', '-h', 'db', '-U', 'db', '-d', $target, '-q', '-v', 'ON_ERROR_STOP=1', '-f', $directory.'/restore.sql']);
    $restoreSeconds = microtime(true) - $started;

    $after = $inspect($target);
    $differences = array_filter(
        array_keys($before['counts'] + $after['counts']),
        fn (string $table) => ($before['counts'][$table] ?? null) !== ($after['counts'][$table] ?? null),
    );
    $checks = [
        'row counts per table' => $differences === [],
        'postgis and pg_trgm installed' => $after['extensions'] === 'pg_trgm,postgis',
        'all constraints valid' => $after['invalid_constraints'] === 0,
        'parking locations identical' => $after['location_checksum'] === $before['location_checksum'],
        'trigram search works' => $after['trigram_matches'] === $before['trigram_matches'],
    ];

    printf("Archive: %s (%.1f KiB, AES-256)\n", $archive->getFilename(), $archive->getSize() / 1024);
    printf("Backup: %.1f s, decrypt and restore: %.1f s\n", $backupSeconds, $restoreSeconds);
    printf("Tables: %d, rows: %d\n", count($after['counts']), array_sum($after['counts']));
    foreach ($checks as $check => $passed) {
        printf("%s %s\n", $passed ? 'PASS' : 'FAIL', $check);
    }
    if ($differences !== []) {
        printf("Differing tables: %s\n", implode(', ', $differences));
    }
    $failed = in_array(false, $checks, true);
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage()."\n".Artisan::output());
    $failed = true;
} finally {
    DB::disconnect('pgsql');
    $run(['dropdb', '-h', 'db', '-U', 'db', '--if-exists', $target]);
    File::deleteDirectory($directory);
}

exit($failed ? 1 : 0);
