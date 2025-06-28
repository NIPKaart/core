<?php

namespace App\Enums;

enum ParkingStatus: string
{
    case PENDING = 'pending';
    case APPROVED = 'approved';
    case REJECTED = 'rejected';

    public function label(): string
    {
        return __("parking_status.{$this->value}.label");
    }

    public function description(): string
    {
        return __("parking_status.{$this->value}.description");
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
            ->mapWithKeys(fn ($status) => [$status->value => $status->label()])
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
