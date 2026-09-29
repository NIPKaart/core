<?php

namespace App\Enums;

/**
 * Whether a sub-sign with extra conditions hangs below the sign; a missing value means it is not known.
 */
enum UnderSign: string
{
    case YES = 'yes';
    case NO = 'no';

    public function label(): string
    {
        return __("enums/under_sign.{$this->value}.label");
    }

    public function description(): string
    {
        return __("enums/under_sign.{$this->value}.description");
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
