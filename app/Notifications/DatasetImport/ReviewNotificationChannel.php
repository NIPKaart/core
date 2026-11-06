<?php

namespace App\Notifications\DatasetImport;

use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\User;
use App\Support\MunicipalSnapshot;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Notifications\Channels\BroadcastChannel;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ReviewNotificationChannel
{
    public function send(User $notifiable, ReadyForReview $notification): void
    {
        DB::transaction(function () use ($notifiable, $notification): void {
            $import = DatasetImport::find($notification->importId);
            if ($import === null) {
                return;
            }
            DatasetSource::whereKey($import->dataset_source_id)->lockForUpdate()->firstOrFail();
            if (! $notification->shouldSend($notifiable, self::class)) {
                return;
            }

            $notices = self::unresolvedForSource($import->dataset_source_id)
                ->where('notifiable_type', $notifiable->getMorphClass())->where('notifiable_id', $notifiable->getKey())
                ->latest('created_at')->latest('id')->get();
            $notice = $notices->first();
            $alert = $notice === null;
            $data = $notification->toDatabase($notifiable)->data;
            if ($notice) {
                $previous = DatasetImport::find($notice->data['meta']['import_id']);
                $changed = $previous === null || MunicipalSnapshot::fingerprint([$previous->dataset_config, $previous->records])
                    !== MunicipalSnapshot::fingerprint([$import->dataset_config, $import->records]);
                $alert = $changed && $notice->read_at !== null;
                $notice->forceFill(['data' => $data, 'read_at' => $changed ? null : $notice->read_at])->save();
                foreach ($notices->skip(1) as $duplicate) {
                    self::resolve($duplicate);
                }
            } else {
                $notice = $notifiable->notifications()->create([
                    'id' => $notification->id ?? (string) Str::uuid(),
                    'type' => ReadyForReview::class, 'data' => $data, 'read_at' => null,
                ]);
            }
            $notification->id = $notice->id;
            if ($alert) {
                DB::afterCommit(fn () => app(BroadcastChannel::class)->send($notifiable, $notification));
            }
        });
    }

    public static function resolveSource(DatasetSource $source): void
    {
        self::unresolvedForSource($source->id)->get()->each(fn (DatabaseNotification $notice) => self::resolve($notice));
    }

    private static function unresolvedForSource(int $sourceId): Builder
    {
        // Laravel's notification data column is text; cast it before querying JSON on PostgreSQL.
        return DatabaseNotification::where('type', ReadyForReview::class)
            ->whereRaw("data::jsonb #>> '{meta,import_id}' IN (SELECT id::text FROM dataset_imports WHERE dataset_source_id = ?)", [$sourceId])
            ->whereRaw("COALESCE((data::jsonb #>> '{meta,resolved}')::boolean, false) = false");
    }

    private static function resolve(DatabaseNotification $notice): void
    {
        $data = $notice->data;
        $data['meta']['resolved'] = true;
        $notice->forceFill(['data' => $data, 'read_at' => $notice->read_at ?? now()])->save();
    }
}
