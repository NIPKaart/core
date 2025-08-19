<?php

namespace App\Notifications\CommunitySpace;

use App\Enums\NotificationType;
use App\Enums\ParkingStatus;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;

class StatusChanged extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public string $spaceId,
        public string $spaceLabel,
        public ?ParkingStatus $oldStatus,
        public ?ParkingStatus $newStatus,
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
            'type' => NotificationType::CommunitySpaceStatusChanged->value,
            'params' => [
                'space_label' => $this->spaceLabel,
                'old_status' => $this->oldStatus?->value,
                'new_status' => $this->newStatus?->value,
            ],
            'url' => route('profile.parking-spaces.show', ['id' => $this->spaceId]),
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
            'id' => (string) \Str::uuid(),
            'type' => NotificationType::CommunitySpaceStatusChanged->value,
            'params' => [
                'space_label' => $this->spaceLabel,
                'old_status' => $this->oldStatus?->value,
                'new_status' => $this->newStatus?->value,
            ],
            'url' => route('profile.parking-spaces.show', ['id' => $this->spaceId]),
            'meta' => [
                'space_id' => $this->spaceId,
                'acted_by' => $this->actedByUserId,
            ],
        ]);
    }
}
