<?php

namespace App\Notifications\MunicipalImport;

use App\Enums\NotificationType;
use App\Enums\UserRole;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;

class ReadyForReview extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $importId, public string $sourceName) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    public function shouldSend(object $notifiable, string $channel): bool
    {
        return $notifiable->hasRole(UserRole::ADMIN);
    }

    public function toDatabase(object $notifiable): DatabaseMessage
    {
        return new DatabaseMessage($this->payload());
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->payload());
    }

    /** @return array{type: string, params: array{source_name: string}, url: string, meta: array{import_id: int}} */
    private function payload(): array
    {
        return [
            'type' => NotificationType::MunicipalImportReadyForReview->value,
            'params' => ['source_name' => $this->sourceName],
            'url' => route('app.municipal-imports.show', $this->importId),
            'meta' => ['import_id' => $this->importId],
        ];
    }
}
