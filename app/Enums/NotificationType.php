<?php

namespace App\Enums;

enum NotificationType: string
{
    case CommunitySpotSubmitted = 'community.spot_submitted';
    case CommunitySpotStatusChanged = 'community.spot_status_changed';
    case CommunitySpotDeleted = 'community.spot_deleted';
    case SystemAnnouncement = 'system.announcement';

    public function label(): string
    {
        return __("backend/notifications.types.{$this->value}");
    }

    public function titleKey(): string
    {
        return __("backend/notifications.titles.{$this->value}");
    }

    public function toArray(): array
    {
        return [
            'value' => $this->value,
            'label' => $this->label(),
        ];
    }

    public static function all(): array
    {
        return array_column(self::cases(), 'value');
    }

    public static function options(): array
    {
        return collect(self::cases())->mapWithKeys(
            fn (self $case) => [$case->value => $case->label()]
        )->toArray();
    }

    public static function mapped(): array
    {
        return collect(self::cases())
            ->map(fn (self $case) => $case->toArray())
            ->values()
            ->toArray();
    }
}
