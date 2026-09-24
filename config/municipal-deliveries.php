<?php

return [
    'enabled' => env('MUNICIPAL_DELIVERIES_ENABLED', false),
    'sources' => [
        'nl-amsterdam' => ['max_age_hours' => 48],
        'nl-eindhoven' => ['max_age_hours' => 48],
    ],
];
