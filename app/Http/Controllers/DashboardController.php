<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Services\ModerationQueue;
use App\Services\SourceOverview;
use App\Services\UserActivity;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The page people land on after signing in: what waits for them, what happened to their contributions, and their
 * saved places. It points to work rather than doing it; moderation happens in the inbox.
 */
class DashboardController extends Controller
{
    private const int QUEUE_PREVIEW = 5;

    public function __invoke(Request $request, ModerationQueue $queue, SourceOverview $sources, UserActivity $activity): Response
    {
        $user = $request->user();
        $moderates = $queue->typesFor($user) !== [];
        $managesSources = $user->hasRole(UserRole::ADMIN);
        $hasTodo = $moderates || $managesSources;

        $validated = $request->validate([
            'section' => ['sometimes', 'in:destinations,favorites,contributions'],
            'contributions_page' => ['sometimes', 'integer', 'min:1', 'max:10000'],
        ]);

        return Inertia::render('dashboard', [
            'section' => $validated['section'] ?? 'destinations',
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
            'contributions' => Inertia::defer(fn () => $activity->contributions($user, (int) ($validated['contributions_page'] ?? 1))),
        ]);
    }
}
