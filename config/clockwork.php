<?php

return [
    // Diagnostics are opt-in locally and cannot be enabled in production.
    'enable' => env('APP_ENV') === 'local' && env('CLOCKWORK_ENABLE', false),
    'collect_data_always' => false,
];
