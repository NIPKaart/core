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
                    'parking-space' => ['view', 'view_any', 'create', 'update', 'delete', 'force-delete', 'restore'],
                    'parking-space-confirmation' => ['view', 'view_any', 'delete'],
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
                    'parking-space' => ['view', 'view_any', 'create', 'update'],
                    'parking-space-confirmation' => ['view', 'view_any', 'delete'],
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
