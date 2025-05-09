<?php

return [
    'roles' => [
        'admin' => [
            'guard_name' => 'web',
            'permissions' => [
                'resource' => [
                    'role' => ['view', 'view_any', 'create', 'update', 'delete', 'delete_any'],
                    'user' => ['view', 'view_any', 'create', 'update', 'delete', 'delete_any', 'restore', 'restore_any', 'replicate', 'reorder', 'force_delete', 'force_delete_any'],
                ],
                'special' => [
                    'download-backup',
                    'delete-backup',
                ],
                'page' => [
                    'Backups',
                ],
            ],
        ],
        'moderator' => [
            'guard_name' => 'web',
            'permissions' => [
                'resource' => [
                    'role' => ['view', 'view_any'],
                    'user' => ['view', 'view_any'],
                ],
            ],
        ],
        'user' => [
            'guard_name' => 'web',
            'permissions' => [
            ],
        ],
    ],
    'direct_permissions' => [
        'download-backup' => 'web',
        'delete-backup' => 'web',
    ],
];
