<?php

return [
    'role' => [
        'label' => 'Rollen en rechten',
        'actions' => [
            'view_any' => [
                'label' => 'Rollen en rechten bekijken',
                'description' => 'Geeft toegang tot het alleen-lezen overzicht van rollen en rechten.',
            ],
        ],
    ],
    'user' => [
        'label' => 'Gebruikers',
        'actions' => [
            'view' => [
                'label' => 'Gebruikers bekijken',
                'description' => 'Geeft toegang tot gebruikersdetails.',
            ],
            'view_any' => [
                'label' => 'Gebruikersoverzicht bekijken',
                'description' => 'Geeft toegang tot het gebruikersoverzicht.',
            ],
            'create' => [
                'label' => 'Gebruikers aanmaken',
                'description' => 'Maakt het aanmaken van nieuwe accounts mogelijk.',
            ],
            'update' => [
                'label' => 'Gebruikers bijwerken',
                'description' => 'Maakt het wijzigen van profielen, rollen en schorsingen mogelijk.',
            ],
            'delete' => [
                'label' => 'Gebruikers verwijderen',
                'description' => 'Maakt het verwijderen van accounts mogelijk.',
            ],
        ],
    ],
    'parking-rule' => [
        'label' => 'Parkeerregels',
        'actions' => [
            'view' => [
                'label' => 'Parkeerregels bekijken',
                'description' => 'Geeft toegang tot de details van een parkeerregel.',
            ],
            'view_any' => [
                'label' => 'Parkeerregeloverzicht bekijken',
                'description' => 'Geeft toegang tot het overzicht van parkeerregels.',
            ],
            'create' => [
                'label' => 'Parkeerregels aanmaken',
                'description' => 'Maakt het toevoegen van parkeerregels mogelijk.',
            ],
            'update' => [
                'label' => 'Parkeerregels bijwerken',
                'description' => 'Maakt het wijzigen van parkeerregels mogelijk.',
            ],
            'delete' => [
                'label' => 'Parkeerregels verwijderen',
                'description' => 'Maakt het verwijderen van parkeerregels mogelijk.',
            ],
        ],
    ],
    'parking-space' => [
        'label' => 'Community-parkeerplaatsen',
        'actions' => [
            'view' => [
                'label' => 'Parkeerplaatsen bekijken',
                'description' => 'Geeft toegang tot de details van community-parkeerplaatsen.',
            ],
            'view_any' => [
                'label' => 'Parkeerplaatsoverzicht bekijken',
                'description' => 'Geeft toegang tot het overzicht van community-parkeerplaatsen.',
            ],
            'create' => [
                'label' => 'Parkeerplaatsen aanmaken',
                'description' => 'Maakt het toevoegen van parkeerplaatsen vanuit beheer mogelijk.',
            ],
            'update' => [
                'label' => 'Parkeerplaatsen beoordelen en bijwerken',
                'description' => 'Maakt het corrigeren, goedkeuren en afwijzen van community-parkeerplaatsen mogelijk.',
            ],
            'delete' => [
                'label' => 'Parkeerplaatsen verwijderen',
                'description' => 'Verplaatst community-parkeerplaatsen naar de prullenbak.',
            ],
            'force-delete' => [
                'label' => 'Parkeerplaatsen definitief verwijderen',
                'description' => 'Verwijdert parkeerplaatsen definitief uit de prullenbak.',
            ],
            'restore' => [
                'label' => 'Parkeerplaatsen herstellen',
                'description' => 'Herstelt parkeerplaatsen uit de prullenbak.',
            ],
        ],
    ],
    'parking-space-confirmation' => [
        'label' => 'Bevestigingen',
        'actions' => [
            'view' => [
                'label' => 'Bevestigingen bekijken',
                'description' => 'Geeft toegang tot de details van bevestigingen.',
            ],
            'view_any' => [
                'label' => 'Bevestigingsoverzicht bekijken',
                'description' => 'Geeft toegang tot de bevestigingen van een parkeerplaats.',
            ],
            'delete' => [
                'label' => 'Bevestigingen verwijderen',
                'description' => 'Maakt het verwijderen van onjuiste bevestigingen mogelijk.',
            ],
        ],
    ],
    'parking-place-report' => [
        'label' => 'Meldingen',
        'actions' => [
            'view_any' => [
                'label' => 'Meldingen bekijken',
                'description' => 'Geeft toegang tot plekken die als verdwenen zijn gemeld.',
            ],
            'resolve' => [
                'label' => 'Meldingen afhandelen',
                'description' => 'Laat een gemelde plek staan, of verwijdert een communityplek en verbergt een gemeentelijke plek.',
            ],
        ],
    ],
    'parking-municipal' => [
        'label' => 'Gemeentelijke parkeerplaatsen',
        'actions' => [
            'view' => [
                'label' => 'Gemeentelijke parkeerplaatsen bekijken',
                'description' => 'Geeft toegang tot de details van geïmporteerde gemeentelijke records.',
            ],
            'view_any' => [
                'label' => 'Gemeentelijk overzicht bekijken',
                'description' => 'Geeft toegang tot het overzicht van gemeentelijke parkeerplaatsen.',
            ],
            'create' => [
                'label' => 'Gemeentelijke parkeerplaatsen aanmaken',
                'description' => 'Maakt het handmatig toevoegen van gemeentelijke records mogelijk.',
            ],
            'update' => [
                'label' => 'Gemeentelijke parkeerplaatsen tonen of verbergen',
                'description' => 'Maakt het wijzigen en verbergen van gemeentelijke records mogelijk.',
            ],
            'delete' => [
                'label' => 'Gemeentelijke parkeerplaatsen verwijderen',
                'description' => 'Maakt het verwijderen van gemeentelijke records mogelijk.',
            ],
        ],
    ],
    'parking-offstreet' => [
        'label' => 'Garages en P+R',
        'actions' => [
            'view' => [
                'label' => 'Garages bekijken',
                'description' => 'Geeft toegang tot de details van garages en P+R-locaties.',
            ],
            'view_any' => [
                'label' => 'Garageoverzicht bekijken',
                'description' => 'Geeft toegang tot het overzicht van garages en P+R-locaties.',
            ],
            'create' => [
                'label' => 'Garages aanmaken',
                'description' => 'Maakt het handmatig toevoegen van garages mogelijk.',
            ],
            'update' => [
                'label' => 'Garages tonen of verbergen',
                'description' => 'Maakt het wijzigen en verbergen van garages en P+R-locaties mogelijk.',
            ],
            'delete' => [
                'label' => 'Garages verwijderen',
                'description' => 'Maakt het verwijderen van garages mogelijk.',
            ],
        ],
    ],
];
