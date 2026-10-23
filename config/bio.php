<?php

return [
    'links' => [
        ['id' => 'contribute', 'route' => 'location-map.add', 'title' => ['nl' => 'Parkeerplaats toevoegen', 'en' => 'Add a parking space'], 'order' => 10, 'enabled' => true],
        ['id' => 'garages', 'route' => 'garages', 'title' => ['nl' => 'Garages en P+R', 'en' => 'Garages and P+R'], 'order' => 20, 'enabled' => true],
        ['id' => 'about', 'route' => 'about', 'title' => ['nl' => 'Over NIPKaart', 'en' => 'About NIPKaart'], 'order' => 30, 'enabled' => true],
        ['id' => 'contact', 'route' => 'contact', 'title' => ['nl' => 'Contact', 'en' => 'Contact'], 'order' => 40, 'enabled' => true],
        ['id' => 'github', 'url' => 'https://github.com/NIPKaart', 'title' => ['nl' => 'GitHub', 'en' => 'GitHub'], 'order' => 50, 'enabled' => true],
    ],
    'campaigns' => [
        [
            'id' => 'complete-the-map',
            'title' => ['nl' => 'Samen maken we de kaart completer.', 'en' => 'Together, we make the map more complete.'],
            'note' => ['nl' => 'Ken je een parkeerplaats die nog ontbreekt?', 'en' => 'Know a parking space that is still missing?'],
            'action' => ['nl' => 'Help mee', 'en' => 'Help us out'],
            'route' => 'location-map.add',
            'image' => '/assets/images/bio/community-parking.webp',
            'order' => 10,
            'enabled' => true,
            // ISO 8601 with explicit offset, e.g. 2026-11-01T09:00:00+01:00. End is exclusive.
            'starts_at' => null,
            'ends_at' => null,
        ],
    ],
    // Add only verified official profiles; no social widgets or remote feeds.
    'socials' => [],
];
