<?php

namespace App\Enums;

enum NotificationType: string
{
    case CommunitySpaceSubmitted = 'community.space_submitted';
    case CommunitySpaceStatusChanged = 'community.space_status_changed';
    case CommunitySpaceDeleted = 'community.space_deleted';
    case CommunitySpaceDeletedByUser = 'community.space_deleted_by_user';
    case CommunitySpaceRestored = 'community.space_restored';
    case SystemAnnouncement = 'system.announcement';

    public function label(): string
    {
        return __("backend/notifications.types.{$this->value}");
    }

    public function titleKey(): string
    {
        return "backend/notifications.titles.{$this->value}";
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
