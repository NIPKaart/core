<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Tells open moderation pages that the queue changed: an item arrived or a moderator decided one. Pages reload their
 * own props, so moderators working side by side see the same queue and badge without refreshing.
 * Queued: a broadcast failure never breaks the submission or decision that caused it.
 */
class ModerationQueueChanged implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    /**
     * @param  'added'|'decided'  $change
     */
    public function __construct(public string $change) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('moderation')];
    }

    public function broadcastAs(): string
    {
        return 'moderation.changed';
    }

    /** @return array{change: string} */
    public function broadcastWith(): array
    {
        return ['change' => $this->change];
    }
}
