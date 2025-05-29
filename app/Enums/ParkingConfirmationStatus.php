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
            self::CONFIRMED => 'Confirm availability',
            self::MOVED => 'Location moved',
            self::UNAVAILABLE => 'Unavailable',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::CONFIRMED => 'The parking spot is confirmed to be available.',
            self::MOVED => 'The parking spot has been moved to a different location.',
            self::UNAVAILABLE => 'The parking spot is currently unavailable.',
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
