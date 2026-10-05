<?php

namespace App\Enums;

/**
 * How the last check of an official parking-rule link went.
 */
enum RuleLinkStatus: string
{
    /** The page opened directly. */
    case OK = 'ok';

    /** The page opened after a redirect; an admin may want to store the new address. */
    case REDIRECTED = 'redirected';

    /** The page did not open: an error status, an unreachable host or a timeout. */
    case BROKEN = 'broken';
}
