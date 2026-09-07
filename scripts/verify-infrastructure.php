<?php

// Run with: ddev exec php scripts/verify-infrastructure.php
// Uses only newly created databases and a temporary local backup disk.
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

if (! $app->environment('local') || ! is_dir('/mnt/ddev_config')) {
    throw new RuntimeException('This isolated verification script must run inside local DDEV.');
}

$id = 'audit_'.bin2hex(random_bytes(6));
$source = $id.'_source';
$target = $id.'_restore';
$directory = sys_get_temp_dir().'/'.$id;
mkdir($directory, 0700);
$password = bin2hex(random_bytes(24));
$run = function (array $arguments): string {
    $process = new Process($arguments, null, ['PGPASSWORD' => 'db']);
    $process->setTimeout(120);
    $process->mustRun();

    return $process->getOutput();
};
config([
    'database.default' => 'pgsql',
    'database.connections.pgsql.url' => null,
    'database.connections.pgsql.host' => 'db',
    'database.connections.pgsql.port' => 5432,
    'database.connections.pgsql.database' => $source,
    'database.connections.pgsql.username' => 'db',
    'database.connections.pgsql.password' => 'db',
    'filesystems.disks.backups' => ['driver' => 'local', 'root' => $directory.'/archives', 'throw' => true],
    'backup.backup.password' => $password,
    'backup.backup.temporary_directory' => $directory.'/temporary',
    'backup.notifications.notifications' => array_map(fn () => [], config('backup.notifications.notifications')),
]);
DB::purge('pgsql');

try {
    $run(['createdb', '-h', 'db', '-U', 'db', $source]);
    $run(['createdb', '-h', 'db', '-U', 'db', $target]);
    if (Artisan::call('migrate', ['--force' => true]) !== 0) {
        throw new RuntimeException(Artisan::output());
    }
    DB::statement('CREATE TABLE restore_probe (value text, location geometry(Point,4326))');
    DB::statement("INSERT INTO restore_probe VALUES ('nipkaart-restore', ST_SetSRID(ST_MakePoint(4.9,52.3),4326))");
    if (Artisan::call('backup:run-encrypted') !== 0) {
        throw new RuntimeException(Artisan::output());
    }
    $archives = File::allFiles($directory.'/archives');
    if (count($archives) !== 1) {
        throw new RuntimeException('Expected one backup archive.');
    }
    $zip = new ZipArchive;
    if ($zip->open($archives[0]->getPathname()) !== true) {
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
    $run(['psql', '-h', 'db', '-U', 'db', '-d', $target, '-v', 'ON_ERROR_STOP=1', '-f', $directory.'/restore.sql']);
    $restored = $run(['psql', '-h', 'db', '-U', 'db', '-d', $target, '-tAc', "SELECT value || ':' || ST_AsText(location) FROM restore_probe"]);
    if (trim($restored) !== 'nipkaart-restore:POINT(4.9 52.3)') {
        throw new RuntimeException('Restored PostGIS data does not match.');
    }
    echo "PASS: encrypted Spatie backup restored into a separate PostgreSQL/PostGIS database.\n";
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage()."\n".Artisan::output());
    $failed = true;
} finally {
    DB::disconnect('pgsql');
    foreach ([$source, $target] as $database) {
        $run(['dropdb', '-h', 'db', '-U', 'db', '--if-exists', $database]);
    }
    File::deleteDirectory($directory);
}

exit(isset($failed) ? 1 : 0);
