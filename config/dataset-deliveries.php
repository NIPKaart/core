<?php

return [
    'enabled' => env('DATASET_DELIVERIES_ENABLED', false),
    // Sources are discovered from the import bucket and approved by an administrator (ADR 0013).
    // A delivery counts as late when it is older than this many expected intervals.
    'late_after_intervals' => 2,
    // Live garage observations older than this are shown as stale, never as current availability (#1221).
    'observation_stale_after_minutes' => 10,
    'automatic_publication' => [
        'limits' => [
            'missing_fraction' => 0.05, 'missing_minimum' => 3, 'missing_absolute' => 50,
            'growth_fraction' => 0.20, 'growth_minimum' => 10, 'growth_absolute' => 200,
            'movement_metres' => 100,
            'missing_deliveries' => 3, 'missing_days' => 7,
        ],
    ],
];
