<?php

namespace App\Enums;

enum ParkingConfirmationStatus: string
{
    case CONFIRMED = 'confirmed';
    case MOVED = 'moved';
    case UNAVAILABLE = 'unavailable';

    public function label(): string
    {
        return match ($this) {
            self::CONFIRMED => 'Confirmed',
            self::MOVED => 'Moved',
            self::UNAVAILABLE => 'Unavailable',
        };
    }

    public static function all(): array
    {
        return array_column(self::cases(), 'value');
    }

    public static function options(): array
    {
        return collect(self::cases())
            ->mapWithKeys(fn ($confirmationStatus) => [$confirmationStatus->value => $confirmationStatus->label()])
            ->toArray();
    }
}
