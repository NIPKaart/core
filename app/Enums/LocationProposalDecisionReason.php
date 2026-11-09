<?php

namespace App\Enums;

enum LocationProposalDecisionReason: string
{
    case NOT_A_DISABLED_BAY = 'not_a_disabled_bay';
    case RESERVED_FOR_REGISTRATION = 'reserved_for_registration';
    case DUPLICATE = 'duplicate';

    public function label(): string
    {
        return __("enums/location_proposal_decision_reason.{$this->value}");
    }

    public static function rejection(): array
    {
        return [self::NOT_A_DISABLED_BAY, self::RESERVED_FOR_REGISTRATION, self::DUPLICATE];
    }
}
