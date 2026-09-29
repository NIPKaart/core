<?php

return [
    'role' => [
        'label' => 'Roles and permissions',
        'actions' => [
            'view_any' => [
                'label' => 'View roles and permissions',
                'description' => 'Grants access to the read-only overview of roles and permissions.',
            ],
        ],
    ],
    'user' => [
        'label' => 'Users',
        'actions' => [
            'view' => [
                'label' => 'View users',
                'description' => 'Grants access to user details.',
            ],
            'view_any' => [
                'label' => 'View user overview',
                'description' => 'Grants access to the user overview.',
            ],
            'create' => [
                'label' => 'Create users',
                'description' => 'Allows creating new accounts.',
            ],
            'update' => [
                'label' => 'Update users',
                'description' => 'Allows changing profiles, roles and suspensions.',
            ],
            'delete' => [
                'label' => 'Delete users',
                'description' => 'Allows deleting accounts.',
            ],
        ],
    ],
    'parking-rule' => [
        'label' => 'Parking rules',
        'actions' => [
            'view' => [
                'label' => 'View parking rules',
                'description' => 'Grants access to parking rule details.',
            ],
            'view_any' => [
                'label' => 'View parking rule overview',
                'description' => 'Grants access to the parking rule overview.',
            ],
            'create' => [
                'label' => 'Create parking rules',
                'description' => 'Allows adding parking rules.',
            ],
            'update' => [
                'label' => 'Update parking rules',
                'description' => 'Allows changing parking rules.',
            ],
            'delete' => [
                'label' => 'Delete parking rules',
                'description' => 'Allows deleting parking rules.',
            ],
        ],
    ],
    'parking-space' => [
        'label' => 'Community parking spaces',
        'actions' => [
            'view' => [
                'label' => 'View parking spaces',
                'description' => 'Grants access to community parking space details.',
            ],
            'view_any' => [
                'label' => 'View parking space overview',
                'description' => 'Grants access to the community parking space overview.',
            ],
            'create' => [
                'label' => 'Create parking spaces',
                'description' => 'Allows adding parking spaces from administration.',
            ],
            'update' => [
                'label' => 'Review and update parking spaces',
                'description' => 'Allows correcting, approving and rejecting community parking spaces.',
            ],
            'delete' => [
                'label' => 'Delete parking spaces',
                'description' => 'Moves community parking spaces to the trash.',
            ],
            'force-delete' => [
                'label' => 'Permanently delete parking spaces',
                'description' => 'Permanently removes parking spaces from the trash.',
            ],
            'restore' => [
                'label' => 'Restore parking spaces',
                'description' => 'Restores parking spaces from the trash.',
            ],
        ],
    ],
    'parking-space-confirmation' => [
        'label' => 'Confirmations',
        'actions' => [
            'view' => [
                'label' => 'View confirmations',
                'description' => 'Grants access to confirmation details.',
            ],
            'view_any' => [
                'label' => 'View confirmation overview',
                'description' => 'Grants access to the confirmations of a parking space.',
            ],
            'delete' => [
                'label' => 'Delete confirmations',
                'description' => 'Allows removing incorrect confirmations.',
            ],
        ],
    ],
    'parking-place-report' => [
        'label' => 'Reports',
        'actions' => [
            'view_any' => [
                'label' => 'View reports',
                'description' => 'Grants access to places reported as no longer existing.',
            ],
            'resolve' => [
                'label' => 'Handle reports',
                'description' => 'Allows keeping a reported place, or deleting a community place and hiding a municipal one.',
            ],
        ],
    ],
    'parking-municipal' => [
        'label' => 'Municipal parking',
        'actions' => [
            'view' => [
                'label' => 'View municipal parking',
                'description' => 'Grants access to imported municipal record details.',
            ],
            'view_any' => [
                'label' => 'View municipal overview',
                'description' => 'Grants access to the municipal parking overview.',
            ],
            'create' => [
                'label' => 'Create municipal parking',
                'description' => 'Allows adding municipal records manually.',
            ],
            'update' => [
                'label' => 'Show or hide municipal parking',
                'description' => 'Allows changing and hiding municipal records.',
            ],
            'delete' => [
                'label' => 'Delete municipal parking',
                'description' => 'Allows deleting municipal records.',
            ],
        ],
    ],
    'parking-offstreet' => [
        'label' => 'Garages and P+R',
        'actions' => [
            'view' => [
                'label' => 'View garages',
                'description' => 'Grants access to garage and P+R details.',
            ],
            'view_any' => [
                'label' => 'View garage overview',
                'description' => 'Grants access to the garage and P+R overview.',
            ],
            'create' => [
                'label' => 'Create garages',
                'description' => 'Allows adding garages manually.',
            ],
            'update' => [
                'label' => 'Show or hide garages',
                'description' => 'Allows changing and hiding garages and P+R locations.',
            ],
            'delete' => [
                'label' => 'Delete garages',
                'description' => 'Allows deleting garages.',
            ],
        ],
    ],
];
