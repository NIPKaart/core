<?php

namespace App\Notifications\ParkingPlace;

use App\Enums\NotificationType;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * Tells a reporter what a moderator decided about a place they reported as no longer existing.
 */
class ReportResolved extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  string|null  $placeUrl  a map link that reopens the place, or null when it is no longer on the map
     * @param  string|null  $reason  the RemovalReason value, only when the place was removed
     */
    public function __construct(
        public string $placeLabel,
        public bool $removed,
        public ?string $placeUrl,
        public ?string $reason = null,
        public ?int $actedByUserId = null,
    ) {}

    /**
     * Get the notification's delivery channels; moderators deciding on their own report are not notified.
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
            'type' => ($this->removed ? NotificationType::ReportPlaceRemoved : NotificationType::ReportPlaceKept)->value,
            'params' => [
                'space_label' => $this->placeLabel,
                'reason' => $this->reason !== null ? "removal.{$this->reason}" : null,
            ],
            'url' => $this->placeUrl,
            'meta' => [
                'acted_by' => $this->actedByUserId,
            ],
        ];
    }
}
