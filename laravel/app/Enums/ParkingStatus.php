<?php

namespace App\Enums;

use Filament\Support\Contracts\HasLabel;

enum ParkingStatus: string implements HasLabel
{
    case PENDING = 'pending';
    case APPROVED = 'approved';
    case REJECTED = 'rejected';

    public static function toArray(): array
    {
        return array_column(ParkingStatus::cases(), 'value');
    }

    public function getLabel(): string
    {
        return match ($this) {
            ParkingStatus::PENDING => 'Pending',
            ParkingStatus::APPROVED => 'Approved',
            ParkingStatus::REJECTED => 'Rejected',
        };
    }
}
