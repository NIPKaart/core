<?php

namespace App\Enums;

enum ApiState: string
{
    case OK = 'ok';
    case ERROR = 'error';
    case UNKNOWN = 'unknown';

    public function label(): string
    {
        return match ($this) {
            self::OK => 'OK',
            self::ERROR => 'Error',
            self::UNKNOWN => 'Unknown',
        };
    }

    public static function all(): array
    {
        return array_column(self::cases(), 'value');
    }

    public static function options(): array
    {
        return collect(self::cases())
            ->mapWithKeys(fn ($state) => [$state->value => $state->label()])
            ->toArray();
    }
}
