<?php

namespace App\Enums;

/**
 * Why a moderator removed or hid a reported parking place; destructive moderation always records one.
 */
enum RemovalReason: string
{
    case NO_LONGER_EXISTS = 'no_longer_exists';
    case NOT_A_DISABLED_BAY = 'not_a_disabled_bay';
    case DUPLICATE = 'duplicate';
    case OTHER = 'other';

    public function label(): string
    {
        return __("enums/removal_reason.{$this->value}.label");
    }

    public function description(): string
    {
        return __("enums/removal_reason.{$this->value}.description");
    }

    public function toArray(): array
    {
        return [
            'value' => $this->value,
            'label' => $this->label(),
            'description' => $this->description(),
        ];
    }

    public static function all(): array
    {
        return array_column(self::cases(), 'value');
    }

    public static function mapped(): array
    {
        return array_map(fn (self $case): array => $case->toArray(), self::cases());
    }
}
