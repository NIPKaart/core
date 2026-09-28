<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Public signal that garage occupancy changed. It carries no data: an open garage detail refetches its own,
 * so freshness rules stay on the server (#1221).
 */
class OffstreetObservationsApplied implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    /** @return array<int, Channel> */
    public function broadcastOn(): array
    {
        return [new Channel('parking-offstreet')];
    }

    public function broadcastAs(): string
    {
        return 'observations.applied';
    }

    /** @return array<string, never> */
    public function broadcastWith(): array
    {
        return [];
    }
}
