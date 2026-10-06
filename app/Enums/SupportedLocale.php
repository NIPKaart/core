<?php

namespace App\Enums;

enum SupportedLocale: string
{
    case EN = 'en';
    case NL = 'nl';

    public function label(): string
    {
        return match ($this) {
            self::EN => 'English', self::NL => 'Nederlands'
        };
    }

    public function formatLocale(): string
    {
        return match ($this) {
            self::EN => 'en-GB', self::NL => 'nl-NL'
        };
    }

    public static function default(): self
    {
        return self::tryFrom(config('app.locale')) ?? self::EN;
    }

    public static function parse(mixed $value): ?self
    {
        return is_string($value) ? self::tryFrom($value) : null;
    }

    /** @return list<array{code: string, label: string, formatLocale: string}> */
    public static function options(): array
    {
        return array_map(fn (self $locale): array => [
            'code' => $locale->value, 'label' => $locale->label(), 'formatLocale' => $locale->formatLocale(),
        ], self::cases());
    }
}
