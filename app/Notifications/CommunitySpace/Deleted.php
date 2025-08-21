<?php

namespace App\Notifications\CommunitySpace;

use App\Enums\NotificationType;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class Deleted extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public string $spaceId,
        public string $spaceLabel,
        public ?int $actedByUserId = null
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if ($this->actedByUserId !== null && (int) $notifiable->getKey() === (int) $this->actedByUserId) {
            return [];
        }

        return ['database', 'broadcast'];
    }

    /**
     * Send the notification via the database channel.
     */
    public function toDatabase($notifiable): DatabaseMessage
    {
        return new DatabaseMessage([
            'type' => NotificationType::CommunitySpaceDeleted->value,
            'params' => [
                'space_label' => $this->spaceLabel,
            ],
            'url' => null,
            'meta' => [
                'space_id' => $this->spaceId,
                'acted_by' => $this->actedByUserId,
            ],
        ]);
    }

    /**
     * Send the notification via the broadcast channel.
     */
    public function toBroadcast($notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'id' => (string) Str::uuid(),
            'type' => NotificationType::CommunitySpaceDeleted->value,
            'params' => [
                'space_label' => $this->spaceLabel,
            ],
            'url' => null,
            'meta' => [
                'space_id' => $this->spaceId,
                'acted_by' => $this->actedByUserId,
            ],
        ]);
    }
}
