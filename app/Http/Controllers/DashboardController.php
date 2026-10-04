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

    public function __invoke(Request $request, ModerationQueue $queue, SourceOverview $sources, UserActivity $activity): Response
    {
        $user = $request->user();
        $moderates = $queue->typesFor($user) !== [];
        $managesSources = $user->hasRole(UserRole::ADMIN);

        return Inertia::render('dashboard', [
            'hasTodo' => $moderates || $managesSources,
            'todo' => Inertia::defer(function () use ($queue, $sources, $user, $moderates, $managesSources) {
                $attention = $managesSources ? $sources->rows()->whereIn('status', SourceOverview::ATTENTION)->values() : collect();

                return [
                    'moderation' => $moderates ? $queue->summary($user) : null,
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
