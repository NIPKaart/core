<?php

namespace App\Notifications\CommunitySpace;

use App\Enums\NotificationType;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class DeletedByUser extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public string $spaceId,
        public string $spaceLabel,
        public string $ownerName,
        public int $ownerId,
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    public function toDatabase($notifiable): DatabaseMessage
    {
        return new DatabaseMessage([
            'type' => NotificationType::CommunitySpaceDeletedByUser->value,
            'params' => [
                'space_label' => $this->spaceLabel,
                'owner_name' => $this->ownerName,
            ],
            'url' => route('app.parking-spaces.trash'),

            'meta' => [
                'space_id' => $this->spaceId,
                'deleted_by' => $this->ownerId,
                'trashed' => true,
            ],
        ]);
    }

    public function toBroadcast($notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'id' => (string) Str::uuid(),
            'type' => NotificationType::CommunitySpaceDeletedByUser->value,
            'params' => [
                'space_label' => $this->spaceLabel,
                'owner_name' => $this->ownerName,
            ],
            'url' => route('app.parking-spaces.trash'),
            'meta' => [
                'space_id' => $this->spaceId,
                'deleted_by' => $this->ownerId,
                'trashed' => true,
            ],
        ]);
    }
}
