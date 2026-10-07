<?php

/** @return array<string, string> */
function catalogMessageLeaves(array $messages, string $prefix = ''): array
{
    $leaves = [];
    foreach ($messages as $key => $value) {
        $path = $prefix === '' ? (string) $key : $prefix.'.'.$key;
        if (is_array($value)) {
            $leaves += catalogMessageLeaves($value, $path);
        } else {
            expect($value)->toBeString();
            $leaves[$path] = $value;
        }
    }

    return $leaves;
}

/** @return list<string> */
function catalogMessagePlaceholders(string $message): array
{
    preg_match_all('/(?<![a-z]):([a-z_]+)/i', $message, $matches);
    $placeholders = array_map('strtolower', $matches[1]);
    sort($placeholders);

    return $placeholders;
}

function assertCatalogMessages(array $english, array $dutch): void
{
    $en = catalogMessageLeaves($english);
    $nl = catalogMessageLeaves($dutch);
    $enKeys = array_keys($en);
    $nlKeys = array_keys($nl);
    sort($enKeys);
    sort($nlKeys);
    expect($nlKeys)->toBe($enKeys);
    foreach ($en as $key => $message) {
        expect(trim($message))->not->toBe('');
        expect(trim($nl[$key]))->not->toBe('');
        expect(catalogMessagePlaceholders($nl[$key]))->toBe(catalogMessagePlaceholders($message));
    }
}

test('application PHP catalogs preserve keys and placeholders between languages', function () {
    $root = dirname(__DIR__, 2).'/resources/lang/';
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root.'en', FilesystemIterator::SKIP_DOTS));
    foreach ($files as $file) {
        if ($file->getExtension() !== 'php') {
            continue;
        }
        $relative = substr($file->getPathname(), strlen($root.'en/'));
        assertCatalogMessages(require $file->getPathname(), require $root.'nl/'.$relative);
    }
});

test('Dutch framework catalogs preserve the installed framework message contracts', function () {
    $root = dirname(__DIR__, 2);
    foreach (['auth', 'passwords', 'validation'] as $catalog) {
        $en = require $root.'/vendor/laravel/framework/src/Illuminate/Translation/lang/en/'.$catalog.'.php';
        $nl = require $root.'/resources/lang/nl/'.$catalog.'.php';
        unset($en['attributes'], $en['custom'], $nl['attributes'], $nl['custom']);
        assertCatalogMessages($en, $nl);
    }
});

test('sentence based Dutch messages are nonempty and preserve placeholders', function () {
    $messages = json_decode(file_get_contents(dirname(__DIR__, 2).'/resources/lang/nl.json'), true, flags: JSON_THROW_ON_ERROR);
    foreach ($messages as $english => $dutch) {
        expect(trim($dutch))->not->toBe('');
        expect(catalogMessagePlaceholders($dutch))->toBe(catalogMessagePlaceholders($english));
    }
});
