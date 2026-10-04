<?php

namespace App\Notifications\CommunitySpace;

use App\Enums\NotificationType;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * Tells the proposer that a moderator approved or rejected their improvement to a community parking space.
 */
class ImprovementDecided extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  string|null  $reason  the ImprovementRejectionReason value, only for a rejection
     * @param  list<string>  $changes  the change groups that were applied, only for an approval
     */
    public function __construct(
        public string $spaceId,
        public string $spaceLabel,
        public bool $approved,
        public string $placeUrl,
        public ?string $reason = null,
        public ?int $actedByUserId = null,
        public array $changes = [],
    ) {}

    /**
     * Get the notification's delivery channels; moderators deciding on their own proposal are not notified.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if ($this->actedByUserId !== null && (int) $notifiable->getKey() === $this->actedByUserId) {
            return [];
        }

        return ['database', 'broadcast'];
    }

    public function toDatabase(object $notifiable): DatabaseMessage
    {
        return new DatabaseMessage($this->payload());
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage(['id' => (string) Str::uuid(), ...$this->payload()]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        return [
            'type' => ($this->approved ? NotificationType::CommunityImprovementApproved : NotificationType::CommunityImprovementRejected)->value,
            'params' => [
                'space_label' => $this->spaceLabel,
                'reason' => $this->reason !== null ? "improvement.{$this->reason}" : null,
                'changes' => $this->changes,
            ],
            'url' => $this->placeUrl,
            'meta' => [
                'space_id' => $this->spaceId,
                'acted_by' => $this->actedByUserId,
            ],
        ];
    }
}
