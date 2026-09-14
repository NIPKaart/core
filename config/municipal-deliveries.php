<?php

return [
    'enabled' => env('MUNICIPAL_DELIVERIES_ENABLED', false),
    'sources' => [
        'nl-amsterdam-parkeervakken-e6a' => ['max_age_hours' => 48],
    ],
];
