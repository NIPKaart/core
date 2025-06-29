<?php

namespace App\Enums;

enum ParkingConfirmationStatus: string
{
    case CONFIRMED = 'confirmed';
    case MOVED = 'moved';
    case UNAVAILABLE = 'unavailable';

    public function label(): string
    {
        return __("parking_confirmation.{$this->value}.label");
    }

    public function description(): string
    {
        return __("parking_confirmation.{$this->value}.description");
    }

    public static function all(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function toArray(): array
    {
        return [
            'value' => $this->value,
            'label' => $this->label(),
            'description' => $this->description(),
        ];
    }

    public static function options(): array
    {
        return collect(self::cases())
            ->mapWithKeys(fn ($confirmationStatus) => [$confirmationStatus->value => $confirmationStatus->label()])
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
