<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Tells open admin pages that dataset data changed, so they reload their own props instead of waiting for a refresh.
 * Queued: a broadcast failure never breaks the intake, review or publication that caused it.
 */
class DatasetDataChanged implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    /**
     * @param  'sources'|'deliveries'|'imports'|'observations'  $scope
     * @param  'municipal'|'offstreet'|null  $targetType
     */
    public function __construct(public string $scope, public ?string $targetType = null) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('datasets')];
    }

    public function broadcastAs(): string
    {
        return 'dataset.changed';
    }

    /** @return array{scope: string, target_type: ?string} */
    public function broadcastWith(): array
    {
        return ['scope' => $this->scope, 'target_type' => $this->targetType];
    }
}
