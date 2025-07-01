<?php

namespace App\Enums;

enum ParkingOrientation: string
{
    case PARALLEL = 'parallel';
    case PERPENDICULAR = 'perpendicular';
    case ANGLE = 'angle';

    public function label(): string
    {
        return __("enums/parking_orientation.{$this->value}.label");
    }

    public function description(): string
    {
        return __("enums/parking_orientation.{$this->value}.description");
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

    public static function options(): array
    {
        return collect(self::cases())
            ->mapWithKeys(fn ($orientation) => [$orientation->value => $orientation->label()])
            ->toArray();
    }

    public static function mapped(): array
    {
        return collect(self::cases())->map(fn ($case) => [
            'value' => $case->value,
            'label' => $case->label(),
            'description' => $case->description(),
        ])->values()->toArray();
    }
}
