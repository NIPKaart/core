<?php

namespace App\Enums;

/**
 * What a reporter saw at a place they report as gone; optional, next to a free note.
 */
enum ReportReason: string
{
    case SIGN_REMOVED = 'sign_removed';
    case NOW_REGULAR_BAY = 'now_regular_bay';
    case OTHER = 'other';

    public function label(): string
    {
        return __("enums/report_reason.{$this->value}.label");
    }

    public static function all(): array
    {
        return array_column(self::cases(), 'value');
    }
}
