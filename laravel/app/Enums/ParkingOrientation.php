<?php

namespace App\Enums;

use Filament\Support\Contracts\HasLabel;

enum ParkingOrientation: string implements HasLabel
{
    case PARALLEL = 'parallel';
    case PERPENDICULAR = 'perpendicular';
    case ANGLE = 'angle';

    public static function toArray(): array
    {
        return array_column(ParkingOrientation::cases(), 'value');
    }

    public function getLabel(): string
    {
        return match ($this) {
            ParkingOrientation::PARALLEL => 'Parallel',
            ParkingOrientation::PERPENDICULAR => 'Perpendicular',
            ParkingOrientation::ANGLE => 'Angle',
        };
    }
}
