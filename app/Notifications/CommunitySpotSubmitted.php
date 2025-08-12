<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;

class CommunitySpotSubmitted extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public string $spotId,
        public string $spotLabel,
        public int $submittedByUserId
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if ((int) $notifiable->getKey() === (int) $this->submittedByUserId) {
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
            'type' => 'community_spot_submitted',
            'spot_id' => $this->spotId,
            'spot_label' => $this->spotLabel,
            'submitted_by' => $this->submittedByUserId,
            'url' => route('app.parking-spaces.show', $this->spotId),
        ]);
    }

    /**
     * Send the notification via the broadcast channel.
     */
    public function toBroadcast($notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'id' => (string) \Str::uuid(),
            'type' => 'community_spot_submitted',
            'spot_id' => $this->spotId,
            'spot_label' => $this->spotLabel,
            'submitted_by' => $this->submittedByUserId,
            'url' => route('app.parking-spaces.show', $this->spotId),
        ]);
    }
}
