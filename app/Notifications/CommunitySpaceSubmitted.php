<?php

namespace App\Notifications;

use App\Enums\NotificationType;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;

class CommunitySpaceSubmitted extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public string $spotId,
        public string $spotLabel,
        public ?int $submittedByUserId = null
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if (
            $this->submittedByUserId !== null &&
            (int) $notifiable->getKey() === (int) $this->submittedByUserId
        ) {
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
            'type' => NotificationType::CommunitySpaceSubmitted->value,
            'params' => [
                'spot_label' => $this->spotLabel,
            ],
            'url' => route('app.parking-spaces.show', (string) $this->spotId),
            'meta' => [
                'spot_id' => $this->spotId,
                'submitted_by' => $this->submittedByUserId,
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
            'type' => NotificationType::CommunitySpaceSubmitted->value,
            'params' => [
                'spot_label' => $this->spotLabel,
            ],
            'url' => route('app.parking-spaces.show', (string) $this->spotId),
            'meta' => [
                'spot_id' => $this->spotId,
                'submitted_by' => $this->submittedByUserId,
            ],
        ]);
    }
}
