<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Public signal carrying the IDs of visible facilities whose occupancy was updated.
 */
class OffstreetObservationsApplied implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    /** @param list<string> $garageIds */
    public function __construct(private array $garageIds, private bool $detailOnly = false) {}

    /** @return array<int, Channel> */
    public function broadcastOn(): array
    {
        return [new Channel('parking-offstreet')];
    }

    public function broadcastAs(): string
    {
        return ($this->detailOnly ?? false) ? 'observations.details-applied' : 'observations.applied';
    }

    /** @return array{garage_ids: list<string>} */
    public function broadcastWith(): array
    {
        return ['garage_ids' => $this->garageIds ?? []];
    }
}
