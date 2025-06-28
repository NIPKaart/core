<?php

namespace App\Enums;

enum ParkingOrientation: string
{
    case PARALLEL = 'parallel';
    case PERPENDICULAR = 'perpendicular';
    case ANGLE = 'angle';

    public function label(): string
    {
        return __("parking_orientation.{$this->value}.label");
    }

    public function description(): string
    {
        return __("parking_orientation.{$this->value}.description");
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
