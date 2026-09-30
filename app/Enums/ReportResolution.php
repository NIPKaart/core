<?php

namespace App\Enums;

/**
 * How a moderator closed a report that a parking place no longer exists.
 */
enum ReportResolution: string
{
    /** The place stays published, because it exists or its disappearance is uncertain. */
    case KEPT = 'kept';

    /** The place was hidden (municipal); a removed community place takes its reports with it. */
    case REMOVED = 'removed';
}
