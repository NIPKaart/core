<?php

namespace App\Observers;

use App\Models\ParkingSpace;
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

        if ($parkingSpace->user) {
            Notification::send(
                $parkingSpace->user,
                new CommunitySpace\StatusChanged(
                    spaceId: $parkingSpace->id,
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

        if ($parkingSpace->user()->withTrashed()->exists()) {
            Notification::send(
                $parkingSpace->user,
                new CommunitySpace\Deleted(
                    spaceId: $parkingSpace->id,
                    spaceLabel: $label,
                    actedByUserId: $actorId
                )
            );
        }
    }

    /**
     * Handle the ParkingSpace "restored" event.
     */
    public function restored(ParkingSpace $parkingSpace): void
    {
        //
    }

    /**
     * Handle the ParkingSpace "force deleted" event.
     */
    public function forceDeleted(ParkingSpace $parkingSpace): void
    {
        $this->deleted($parkingSpace);
    }
}
