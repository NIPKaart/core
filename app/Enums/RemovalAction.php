<?php

namespace App\Enums;

/**
 * What removing a reported place did: community places are deleted, imported municipal places are hidden.
 */
enum RemovalAction: string
{
    case DELETED = 'deleted';
    case HIDDEN = 'hidden';
}
