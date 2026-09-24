<?php

return [
    'enabled' => env('MUNICIPAL_DELIVERIES_ENABLED', false),
    'sources' => [
        'nl-amsterdam' => [
            'max_age_hours' => 48,
            'municipality' => ['name' => 'Amsterdam', 'country' => 'NL', 'province' => 'NL-NH'],
            'registration' => [
                'name' => 'Amsterdam — algemene gehandicaptenparkeerplaatsen',
                'selection' => 'e6a-all', 'target_type' => 'municipal',
                'source_url' => 'https://api.data.amsterdam.nl/v1/parkeervakken/parkeervakken/',
                'attribution' => 'Gemeente Amsterdam; parkeervakken E6a; capaciteit is een schatting.',
                'terms_url' => 'https://data.overheid.nl/dataset/318a98b8-ef87-4335-9674-f5405f2bc4be',
                'bounds' => [4.65, 52.2, 5.15, 52.5],
            ],
        ],
        'nl-eindhoven' => [
            'max_age_hours' => 48,
            'municipality' => ['name' => 'Eindhoven', 'country' => 'NL', 'province' => 'NL-NB'],
            'registration' => [
                'name' => 'Eindhoven — gehandicaptenparkeerplaatsen (bronbeoordeling)',
                'selection' => 'gehandicapten-all', 'target_type' => 'municipal',
                'source_url' => 'https://data.eindhoven.nl/explore/dataset/parkeerplaatsen/',
                'attribution' => 'Gemeente Eindhoven; publiek domein volgens het dataportaal. Algemeen gebruik, ID-stabiliteit en actualiteit nog niet bevestigd.',
                'terms_url' => 'https://data.eindhoven.nl/explore/dataset/parkeerplaatsen/information/',
                'bounds' => [5.32, 51.35, 5.62, 51.52],
            ],
        ],
    ],
];
