<?php

use Illuminate\Filesystem\Filesystem;
use Symfony\Component\Process\Process;

test('updates Boost only for development and propagates the command result', function (string|false $devMode, int $commandExitCode, int $expectedExitCode, string $expectedOutput) {
    $directory = sys_get_temp_dir().'/nipkaart-boost-'.bin2hex(random_bytes(8));
    mkdir($directory.'/scripts', 0700, true);
    copy(__DIR__.'/../../scripts/update-boost.php', $directory.'/scripts/update-boost.php');
    file_put_contents($directory.'/artisan', '<?php echo implode(" ", array_slice($_SERVER["argv"], 1)); exit((int) getenv("BOOST_TEST_EXIT"));');

    try {
        $process = new Process([PHP_BINARY, $directory.'/scripts/update-boost.php'], $directory, [
            'COMPOSER_DEV_MODE' => $devMode,
            'BOOST_TEST_EXIT' => (string) $commandExitCode,
        ]);
        $process->run();

        expect($process->getExitCode())->toBe($expectedExitCode);
        expect($process->getOutput())->toBe($expectedOutput);
    } finally {
        (new Filesystem)->deleteDirectory($directory);
    }
})->with([
    'development update' => ['1', 0, 0, 'boost:update --ansi --no-interaction --no-discover'],
    'direct invocation' => [false, 0, 0, 'boost:update --ansi --no-interaction --no-discover'],
    'failed update' => ['1', 7, 7, 'boost:update --ansi --no-interaction --no-discover'],
    'production skips Artisan' => ['0', 7, 0, ''],
]);
