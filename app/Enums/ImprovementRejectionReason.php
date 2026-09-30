<?php

namespace App\Enums;

/**
 * Why a moderator rejected a proposed improvement to a community parking space.
 */
enum ImprovementRejectionReason: string
{
    case INCORRECT = 'incorrect';
    case INSUFFICIENT_INFORMATION = 'insufficient_information';
    case SPAM = 'spam';
    case OTHER = 'other';

    public function label(): string
    {
        return __("enums/improvement_rejection_reason.{$this->value}");
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function mapped(): array
    {
        return array_map(fn (self $case): array => ['value' => $case->value, 'label' => $case->label()], self::cases());
    }
}
