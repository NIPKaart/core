<?php

return [
    'roles' => [
        'admin' => [
            'guard_name' => 'web',
            'permissions' => [
                'resource' => [
                    'role' => ['view', 'view_any', 'create', 'update', 'delete'],
                    'user' => ['view', 'view_any', 'create', 'update', 'delete'],
                    'parking-rule' => ['view', 'view_any', 'create', 'update', 'delete'],
                    'user-parking-spot' => ['view', 'view_any', 'create', 'update', 'delete', 'force-delete', 'restore'],
                ],
            ],
        ],
        'moderator' => [
            'guard_name' => 'web',
            'permissions' => [
                'resource' => [
                    'role' => ['view', 'view_any'],
                    'user' => ['view', 'view_any'],
                    'parking-rule' => ['view', 'view_any'],
                ],
            ],
        ],
        'user' => [
            'guard_name' => 'web',
            'permissions' => [
                'resource' => [],
            ],
        ],
    ],
];
