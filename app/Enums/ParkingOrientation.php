<?php

namespace App\Enums;

enum ParkingOrientation: string
{
    case PARALLEL = 'parallel';
    case PERPENDICULAR = 'perpendicular';
    case ANGLE = 'angle';

    public function label(): string
    {
        return match ($this) {
            self::PARALLEL => 'Parallel',
            self::PERPENDICULAR => 'Perpendicular',
            self::ANGLE => 'Angle',
        };
    }

    public static function all(): array
    {
        return array_column(self::cases(), 'value');
    }

    public static function options(): array
    {
        return collect(self::cases())
            ->mapWithKeys(fn ($orientation) => [$orientation->value => $orientation->label()])
            ->toArray();
    }
}