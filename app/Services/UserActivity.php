<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Enums\ParkingStatus;
use App\Models\Favorite;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceImprovement;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * What happened to a person's own contributions, newest first: decisions they were notified about, merged with what
 * they did themselves. It reads the existing notifications and records; nothing is stored for it.
 */
final class UserActivity
{
    /** Decisions about the person's own contributions; operational notifications belong to the to-do list. */
    public const array OUTCOMES = [
        NotificationType::CommunitySpaceStatusChanged,
        NotificationType::CommunitySpaceDeleted,
        NotificationType::CommunitySpaceRestored,
        NotificationType::CommunityImprovementApproved,
        NotificationType::CommunityImprovementRejected,
        NotificationType::ReportPlaceKept,
        NotificationType::ReportPlaceRemoved,
    ];

    /**
     * @return Collection<int, array{key: string, kind: string, at: string, unread: bool, url: ?string, params: array<string, mixed>}>
     */
    public function recent(User $user, int $limit = 10): Collection
    {
        return $this->outcomes($user, $limit)
            ->concat($this->submissions($user, $limit))
            ->concat($this->improvements($user, $limit))
            ->concat($this->saved($user, $limit))
            ->sortByDesc('at')
            ->take($limit)
            ->values();
    }

    /**
     * Whether the public map shows the place; hidden places are referred to without their name or location.
     */
    public static function isPublic(ParkingSpace|ParkingMunicipal|ParkingOffstreet $place): bool
    {
        return $place instanceof ParkingSpace ? $place->status === ParkingStatus::APPROVED : (bool) $place->visibility;
    }

    /**
     * Where a place is on the public map.
     */
    public static function mapUrl(ParkingSpace|ParkingMunicipal|ParkingOffstreet $place): string
    {
        $source = match (true) {
            $place instanceof ParkingSpace => 'community',
            $place instanceof ParkingMunicipal => 'municipal',
            default => 'offstreet',
        };

        return route('location-map', [
            'place' => "{$source}:{$place->getKey()}",
            'at' => sprintf('%.5f,%.5f', $place->latitude, $place->longitude),
        ]);
    }

    /**
     * Outcome notifications; their kind lives in the JSON data, so the filter reads it there.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function outcomes(User $user, int $limit): Collection
    {
        $types = array_map(fn (NotificationType $type) => $type->value, self::OUTCOMES);

        return $user->notifications()
            ->whereIn(DB::raw("data::jsonb ->> 'type'"), $types)
            ->latest()->limit($limit)->get()
            ->map(fn (DatabaseNotification $notification) => $this->event(
                "notification:{$notification->id}",
                $notification->data['type'],
                $notification->created_at,
                $notification->data['params'] ?? [],
                $notification->data['url'] ?? null,
                $notification->read_at === null,
            ));
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function submissions(User $user, int $limit): Collection
    {
        return $user->parkingSpaces()->with('municipality:id,name')->latest()->limit($limit)->get()
            ->map(fn (ParkingSpace $space) => $this->event(
                "submission:{$space->id}",
                'added',
                $space->created_at,
                ['space_label' => $this->label($space->street, $space->municipality?->name), 'status' => $space->status->value],
                route('profile.parking-spaces.show', ['id' => $space->id]),
            ));
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function improvements(User $user, int $limit): Collection
    {
        return $user->parkingSpaceImprovements()->with('parkingSpace.municipality:id,name')->latest()->limit($limit)->get()
            ->filter(fn (ParkingSpaceImprovement $improvement) => $improvement->parkingSpace !== null)
            ->map(fn (ParkingSpaceImprovement $improvement) => $this->event(
                "improvement:{$improvement->id}",
                'proposed',
                $improvement->created_at,
                ['space_label' => $this->label($improvement->parkingSpace->street, $improvement->parkingSpace->municipality?->name)],
                self::isPublic($improvement->parkingSpace) ? self::mapUrl($improvement->parkingSpace) : null,
            ));
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function saved(User $user, int $limit): Collection
    {
        return $user->favorites()->with(['favoritable' => fn (MorphTo $favoritable) => $favoritable->morphWith([
            ParkingSpace::class => ['municipality:id,name'],
        ])])->latest()->latest('id')->limit($limit)->get()
            ->filter(fn (Favorite $favorite) => $favorite->favoritable !== null)
            ->map(function (Favorite $favorite) {
                $place = $favorite->favoritable;
                $public = self::isPublic($place);

                return $this->event(
                    "favorite:{$favorite->id}",
                    'saved',
                    $favorite->created_at,
                    ['space_label' => $public ? $this->label($place->street ?? $place->name ?? null, $place->city ?? null) : null],
                    $public ? self::mapUrl($place) : null,
                );
            });
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array{key: string, kind: string, at: string, unread: bool, url: ?string, params: array<string, mixed>}
     */
    private function event(string $key, string $kind, Carbon $at, array $params, ?string $url, bool $unread = false): array
    {
        return ['key' => $key, 'kind' => $kind, 'at' => $at->toIso8601String(), 'unread' => $unread, 'url' => $url, 'params' => $params];
    }

    private function label(?string $street, ?string $place): ?string
    {
        $label = collect([$street, $place])->filter()->implode(', ');

        return $label !== '' ? $label : null;
    }
}
