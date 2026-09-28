<?php

return [
    'enabled' => env('DATASET_DELIVERIES_ENABLED', false),
    // Sources are discovered from the import bucket and approved by an administrator (ADR 0013).
    // A delivery counts as late when it is older than this many expected intervals.
    'late_after_intervals' => 2,
];
