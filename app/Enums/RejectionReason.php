<?php

namespace App\Enums;

enum RejectionReason: string
{
    case DUPLICATE = 'duplicate';
    case NOT_A_DISABLED_BAY = 'not_a_disabled_bay';
    case WRONG_LOCATION = 'wrong_location';
    case INSUFFICIENT_INFORMATION = 'insufficient_information';
    case SPAM = 'spam';
    case OTHER = 'other';

    public function label(): string
    {
        return __("enums/rejection_reason.{$this->value}.label");
    }

    public function description(): string
    {
        return __("enums/rejection_reason.{$this->value}.description");
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
