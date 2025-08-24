<?php

namespace App\Observers;

use App\Models\ParkingSpace;
use App\Models\User;
use App\Notifications\CommunitySpace;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;

class ParkingSpaceObserver
{
    /**
     * Handle the ParkingSpace "created" event.
     */
    public function created(ParkingSpace $parkingSpace): void
    {
        //
    }

    /**
     * Handle the ParkingSpace "updated" event.
     */
    public function updated(ParkingSpace $parkingSpace): void
    {
        if (! $parkingSpace->isDirty('status')) {
            return;
        }

        $actorId = optional(Auth::user())->getKey();

        $label = method_exists($parkingSpace, 'label')
            ? $parkingSpace->label()
            : ($parkingSpace->street ?: "Space #{$parkingSpace->id}");

        $oldEnum = $parkingSpace->getOriginal('status');
        $newEnum = $parkingSpace->status;

        $spaceId = $parkingSpace->getRouteKey();

        if ($parkingSpace->user) {
            Notification::send(
                $parkingSpace->user,
                new CommunitySpace\StatusChanged(
                    spaceId: $spaceId,
                    spaceLabel: $label,
                    oldStatus: $oldEnum,
                    newStatus: $newEnum,
                    actedByUserId: $actorId
                )
            );
        }
    }

    /**
     * Handle the ParkingSpace "deleted" event.
     */
    public function deleted(ParkingSpace $parkingSpace): void
    {
        $actorId = optional(Auth::user())->getKey();

        $label = method_exists($parkingSpace, 'label')
            ? $parkingSpace->label()
            : ($parkingSpace->street ?: "Space #{$parkingSpace->id}");

        $spaceId = $parkingSpace->getRouteKey();

        // (1) Always notify the owner
        if ($parkingSpace->user) {
            Notification::send(
                $parkingSpace->user,
                new CommunitySpace\Deleted(
                    spaceId: $spaceId,
                    spaceLabel: $label,
                    actedByUserId: $actorId
                )
            );
        }

        // (2) If the owner deletes it themselves, notify admins/mods
        if ($actorId && (int) $actorId === (int) $parkingSpace->user_id) {
            $admins = User::role(['admin', 'moderator'])->get();

            if ($admins->isNotEmpty()) {
                Notification::send(
                    $admins,
                    new CommunitySpace\DeletedByUser(
                        spaceId: $spaceId,
                        spaceLabel: $label,
                        ownerName: $parkingSpace->user?->name ?? 'Unknown user',
                        ownerId: (int) $parkingSpace->user_id
                    )
                );
            }
        }
    }

    /**
     * Handle the ParkingSpace "restored" event.
     */
    public function restored(ParkingSpace $parkingSpace): void
    {
        $actorId = optional(Auth::user())->getKey();

        $label = method_exists($parkingSpace, 'label')
            ? $parkingSpace->label()
            : ($parkingSpace->street ?: "Space #{$parkingSpace->id}");

        if ($parkingSpace->user) {
            Notification::send(
                $parkingSpace->user,
                new CommunitySpace\Restored(
                    spaceId: (int) $parkingSpace->id,
                    spaceLabel: (string) $label,
                    actedByUserId: $actorId
                )
            );
        }
    }

    /**
     * Handle the ParkingSpace "force deleted" event.
     */
    public function forceDeleted(ParkingSpace $parkingSpace): void
    {
        $this->deleted($parkingSpace);
    }
}
