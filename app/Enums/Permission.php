<?php

namespace App\Enums;

use Illuminate\Support\Str;

enum Permission: string
{
    case ROLE_VIEW_ANY = 'role.view_any';

    case USER_VIEW = 'user.view';
    case USER_VIEW_ANY = 'user.view_any';
    case USER_CREATE = 'user.create';
    case USER_UPDATE = 'user.update';
    case USER_DELETE = 'user.delete';

    case PARKING_RULE_VIEW = 'parking-rule.view';
    case PARKING_RULE_VIEW_ANY = 'parking-rule.view_any';
    case PARKING_RULE_CREATE = 'parking-rule.create';
    case PARKING_RULE_UPDATE = 'parking-rule.update';
    case PARKING_RULE_DELETE = 'parking-rule.delete';

    case PARKING_SPACE_VIEW = 'parking-space.view';
    case PARKING_SPACE_VIEW_ANY = 'parking-space.view_any';
    case PARKING_SPACE_CREATE = 'parking-space.create';
    case PARKING_SPACE_UPDATE = 'parking-space.update';
    case PARKING_SPACE_DELETE = 'parking-space.delete';
    case PARKING_SPACE_FORCE_DELETE = 'parking-space.force-delete';
    case PARKING_SPACE_RESTORE = 'parking-space.restore';

    case PARKING_SPACE_CONFIRMATION_VIEW = 'parking-space-confirmation.view';
    case PARKING_SPACE_CONFIRMATION_VIEW_ANY = 'parking-space-confirmation.view_any';
    case PARKING_SPACE_CONFIRMATION_DELETE = 'parking-space-confirmation.delete';

    case PARKING_MUNICIPAL_VIEW = 'parking-municipal.view';
    case PARKING_MUNICIPAL_VIEW_ANY = 'parking-municipal.view_any';
    case PARKING_MUNICIPAL_CREATE = 'parking-municipal.create';
    case PARKING_MUNICIPAL_UPDATE = 'parking-municipal.update';
    case PARKING_MUNICIPAL_DELETE = 'parking-municipal.delete';

    case PARKING_OFFSTREET_VIEW = 'parking-offstreet.view';
    case PARKING_OFFSTREET_VIEW_ANY = 'parking-offstreet.view_any';
    case PARKING_OFFSTREET_CREATE = 'parking-offstreet.create';
    case PARKING_OFFSTREET_UPDATE = 'parking-offstreet.update';
    case PARKING_OFFSTREET_DELETE = 'parking-offstreet.delete';

    public function label(): string
    {
        return __("enums/permission.{$this->group()}.actions.{$this->action()}.label");
    }

    public function description(): string
    {
        return __("enums/permission.{$this->group()}.actions.{$this->action()}.description");
    }

    public function group(): string
    {
        return Str::before($this->value, '.');
    }

    public function groupLabel(): string
    {
        return __("enums/permission.{$this->group()}.label");
    }

    private function action(): string
    {
        return Str::after($this->value, '.');
    }
}
