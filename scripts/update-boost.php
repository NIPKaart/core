<?php

if (getenv('COMPOSER_DEV_MODE') === '0') {
    exit(0);
}

$_SERVER['argv'] = ['artisan', 'boost:update', '--ansi', '--no-interaction', '--no-discover'];
$_SERVER['argc'] = count($_SERVER['argv']);

require __DIR__.'/../artisan';
