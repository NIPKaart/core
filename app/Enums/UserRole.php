<?php

namespace App\Enums;

/**
 * Cases are ordered by increasing authority; the roles overview shows them in this order.
 */
enum UserRole: string
{
    case USER = 'user';
    case MODERATOR = 'moderator';
    case ADMIN = 'admin';

    public function label(): string
    {
        return __("enums/user_role.{$this->value}.label");
    }

    public function description(): string
    {
        return __("enums/user_role.{$this->value}.description");
    }

    /**
     * The permissions this role holds; PermissionsTableSeeder syncs the stored role to exactly this list.
     *
     * @return list<Permission>
     */
    public function permissions(): array
    {
        return match ($this) {
            self::ADMIN => Permission::cases(),
            self::MODERATOR => [
                Permission::PARKING_RULE_VIEW,
                Permission::PARKING_RULE_VIEW_ANY,
                Permission::PARKING_SPACE_VIEW,
                Permission::PARKING_SPACE_VIEW_ANY,
                Permission::PARKING_SPACE_CREATE,
                Permission::PARKING_SPACE_UPDATE,
                Permission::PARKING_SPACE_CONFIRMATION_VIEW,
                Permission::PARKING_SPACE_CONFIRMATION_VIEW_ANY,
                Permission::PARKING_SPACE_CONFIRMATION_DELETE,
                Permission::PARKING_MUNICIPAL_VIEW,
                Permission::PARKING_MUNICIPAL_VIEW_ANY,
                Permission::PARKING_MUNICIPAL_UPDATE,
                Permission::PARKING_OFFSTREET_VIEW,
                Permission::PARKING_OFFSTREET_VIEW_ANY,
            ],
            self::USER => [],
        };
    }

    public static function all(): array
    {
        return array_column(self::cases(), 'value');
    }

    public static function options(): array
    {
        return collect(self::cases())
            ->mapWithKeys(fn ($role) => [$role->value => $role->label()])
            ->toArray();
    }
}
