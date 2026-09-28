<?php

namespace App\Notifications\DatasetImport;

use App\Enums\NotificationType;
use App\Enums\UserRole;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;

class SourceAwaitingApproval extends Notification implements ShouldQueue
{
    use Queueable;

    /** A changed description of an approved source is a separate notification, so administrators see why it is back. */
    public function __construct(public int $sourceId, public string $sourceName, public string $sourceCode, public bool $reapproval = false) {}

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

    /** @return array{type: string, params: array{source_name: string}, url: string, meta: array{source_id: int}} */
    private function payload(): array
    {
        return [
            'type' => ($this->reapproval ? NotificationType::DatasetSourceAwaitingReapproval : NotificationType::DatasetSourceAwaitingApproval)->value,
            'params' => ['source_name' => $this->sourceName],
            // Opens the source's detail sheet; searching by code keeps it on the first page.
            'url' => route('app.imports.index', ['search' => $this->sourceCode, 'source' => $this->sourceId]),
            'meta' => ['source_id' => $this->sourceId],
        ];
    }
}
