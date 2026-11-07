<?php

beforeEach(function () {
    $this->withServerVariables([
        'SCRIPT_FILENAME' => public_path('index.php'),
        'SCRIPT_NAME' => '/index.php',
    ]);
});

test('the front controller is not publicly available as a page', function (string $path) {
    $this->get($path)->assertNotFound();
})->with(['/index.php', '/index.php?utm_source=legacy']);

test('the homepage is reachable through the front controller', function () {
    $this->get('/')->assertOk();
});
