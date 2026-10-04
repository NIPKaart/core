<?php

namespace App\Http\Controllers;

use App\Enums\ParkingStatus;
use App\Enums\UserRole;
use App\Http\Resources\FavoriteResource;
use App\Models\Favorite;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use App\Services\ModerationQueue;
use App\Services\SourceOverview;
use App\Services\UserActivity;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The page people land on after signing in: what waits for them, what happened to their contributions, and their
 * saved places. It points to work rather than doing it; moderation happens in the inbox.
 */
class DashboardController extends Controller
{
    private const int FAVORITES = 5;

    private const int QUEUE_PREVIEW = 5;

    private const int MAP_PLACES = 500;

    public function __invoke(Request $request, ModerationQueue $queue, SourceOverview $sources, UserActivity $activity): Response
    {
        $user = $request->user();
        $moderates = $queue->typesFor($user) !== [];
        $managesSources = $user->hasRole(UserRole::ADMIN);
        $hasTodo = $moderates || $managesSources;

        $role = UserRole::tryFrom((string) $user->getRoleNames()->first());

        return Inertia::render('dashboard', [
            'profile' => [
                'name' => $user->name,
                'role' => $role?->label(),
                'member_since' => $user->created_at?->toIso8601String(),
            ],
            'hasTodo' => $hasTodo,
            'todo' => Inertia::defer(function () use ($queue, $sources, $user, $moderates, $managesSources) {
                $attention = $managesSources ? $sources->rows()->whereIn('status', SourceOverview::ATTENTION)->values() : collect();

                return [
                    'moderation' => $moderates ? $queue->summary($user) : null,
                    'queue' => $moderates ? $queue->items($user)->take(self::QUEUE_PREVIEW)->map(fn (array $item) => [
                        'key' => $item['key'],
                        'type' => $item['type'],
                        'priority' => $item['priority'],
                        'street' => $item['street'],
                        'municipality' => $item['municipality'],
                        'contributor' => $item['contributor']['name'] ?? null,
                        'reports' => $item['flags']['reports'] ?? null,
                        'waiting_since' => $item['waiting_since'],
                        'url' => route("app.moderation.{$item['type']}s.show", $item['route']),
                    ])->values()->all() : [],
                    'sources' => [
                        'total' => $attention->count(),
                        'items' => $attention->take(3)->map(fn (array $source) => [
                            'id' => $source['id'],
                            'name' => $source['name'],
                            'status' => $source['status'],
                            'import_id' => $source['status'] === 'awaiting_review' ? ($source['latest_import']['id'] ?? null) : null,
                            'since' => $source['latest_import']['retrieved_at'] ?? $source['latest_delivery']['created_at'] ?? null,
                        ])->values()->all(),
                    ],
                ];
            }),
            'activity' => Inertia::defer(fn () => $activity->recent($user)),
            ...($hasTodo ? [] : ['map' => Inertia::defer(fn () => $this->map($request))]),
            'stats' => $this->stats($request),
            'favorites' => $user->favorites()
                ->with(['favoritable' => fn (MorphTo $favoritable) => $favoritable->morphWith([
                    ParkingSpace::class => ['country:id,name', 'municipality:id,name'],
                    ParkingMunicipal::class => ['country:id,name', 'municipality:id,name'],
                    ParkingOffstreet::class => ['country:id,name', 'municipality:id,name'],
                ])])
                ->latest()->latest('id')->limit(self::FAVORITES)->get()
                ->filter(fn (Favorite $favorite) => $favorite->favoritable !== null)
                ->map(function (Favorite $favorite) use ($request) {
                    $row = (new FavoriteResource($favorite))->toArray($request);

                    return [...$row, 'map_url' => $row['available'] ? UserActivity::mapUrl($favorite->favoritable) : null];
                })
                ->values(),
        ]);
    }

    /**
     * The person's own parking spaces and the places they saved, for their map; hidden places are left out.
     *
     * @return array{spaces: list<array<string, mixed>>, favorites: list<array<string, mixed>>}
     */
    private function map(Request $request): array
    {
        $user = $request->user();

        return [
            'spaces' => $user->parkingSpaces()->latest()->limit(self::MAP_PLACES)
                ->get(['id', 'latitude', 'longitude', 'status', 'street'])
                ->map(fn (ParkingSpace $space) => [
                    'id' => $space->id,
                    'latitude' => $space->latitude,
                    'longitude' => $space->longitude,
                    'status' => $space->status->value,
                    'label' => $space->street,
                    'url' => route('profile.parking-spaces.show', ['id' => $space->id]),
                ])->all(),
            'favorites' => $user->favorites()->with('favoritable')->latest()->limit(self::MAP_PLACES)->get()
                ->filter(fn (Favorite $favorite) => $favorite->favoritable !== null && UserActivity::isPublic($favorite->favoritable))
                ->map(fn (Favorite $favorite) => [
                    'id' => $favorite->id,
                    'latitude' => $favorite->favoritable->latitude,
                    'longitude' => $favorite->favoritable->longitude,
                    'label' => $favorite->favoritable->street ?? $favorite->favoritable->name ?? null,
                    'url' => UserActivity::mapUrl($favorite->favoritable),
                ])->values()->all(),
        ];
    }

    /**
     * The person's own contribution figures.
     *
     * @return array{added: int, published: int, pending: int, confirmed: int}
     */
    private function stats(Request $request): array
    {
        $spaces = $request->user()->parkingSpaces()
            ->selectRaw('count(*) as added, count(*) filter (where status = ?) as published, count(*) filter (where status = ?) as pending', [
                ParkingStatus::APPROVED->value,
                ParkingStatus::PENDING->value,
            ])
            ->toBase()->first();

        return [
            'added' => (int) $spaces->added,
            'published' => (int) $spaces->published,
            'pending' => (int) $spaces->pending,
            'confirmed' => $request->user()->confirmations()->count(),
        ];
    }
}
