<?php

namespace App\Http\Controllers;

use App\Enums\RuleLinkStatus;
use App\Enums\UserRole;
use App\Models\ParkingRule;
use App\Models\User;
use App\Services\ModerationHistory;
use App\Services\ModerationQueue;
use App\Services\PersonalOverview;
use App\Services\SourceOverview;
use App\Services\UserActivity;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The page people land on after signing in. Personally: where they are going, the places they saved and what happened
 * to their contributions. Moderators and administrators also get a workplace with the next item to review and what
 * needs attention. It points to work rather than doing it; moderation happens in the inbox.
 */
class DashboardController extends Controller
{
    private const int ATTENTION_PREVIEW = 3;

    public function __invoke(
        Request $request,
        ModerationQueue $queue,
        ModerationHistory $history,
        SourceOverview $sources,
        PersonalOverview $overview,
        UserActivity $activity,
    ): Response {
        $user = $request->user();
        $moderates = $queue->typesFor($user) !== [];
        $managesSources = $user->hasRole(UserRole::ADMIN);
        $managesRules = $user->can('viewAny', ParkingRule::class);
        $hasTodo = $moderates || $managesSources;

        $validated = $request->validate([
            'section' => ['sometimes', 'in:destinations,favorites,contributions'],
            'view' => ['sometimes', 'in:personal,work'],
            'destination' => ['sometimes', 'integer', 'min:1'],
            'contributions_search' => ['nullable', 'string', 'max:200'],
            'contributions_status' => ['nullable', 'in:pending,approved,rejected,kept,removed,unavailable'],
            'contributions_page' => ['sometimes', 'integer', 'min:1', 'max:10000'],
        ]);
        $section = match ($request->route()->getName()) {
            'profile.destinations.index' => 'destinations',
            'profile.favorites.index' => 'favorites',
            'profile.parking-spaces.index' => 'contributions',
            default => $validated['section'] ?? null,
        };

        return Inertia::render('dashboard', [
            'section' => $section,
            'view' => $hasTodo ? ($validated['view'] ?? 'work') : 'personal',
            'hasTodo' => $hasTodo,
            'overview' => Inertia::defer(fn () => $overview->for($user, isset($validated['destination']) ? (int) $validated['destination'] : null)),
            'todo' => Inertia::defer(fn () => [
                'moderation' => $moderates ? $queue->summary($user) : null,
                'next' => $moderates ? $this->nextItem($queue, $user) : null,
                'decisions' => $moderates ? $history->countsBy($user, now()->startOfWeek()) : null,
                'sources' => $this->sourcesNeedingAttention($sources, $managesSources),
                'rules' => $this->brokenRuleLinks($managesSources && $managesRules),
                'attention' => $managesSources,
            ]),
            'contributions' => $section === 'contributions'
                ? Inertia::defer(function () use ($activity, $user, $validated): array {
                    $search = trim($validated['contributions_search'] ?? '');
                    $status = $validated['contributions_status'] ?? null;

                    return [
                        ...$activity->contributions($user, (int) ($validated['contributions_page'] ?? 1), $search, $status)->toArray(),
                        'counts' => $activity->contributionCounts($user, $search),
                        'filters' => ['search' => $search, 'status' => $status],
                    ];
                })
                : null,
        ]);
    }

    /**
     * The first item in the order moderators work through the queue, opening its review directly.
     *
     * @return array<string, mixed>|null
     */
    private function nextItem(ModerationQueue $queue, User $user): ?array
    {
        $item = $queue->items($user)->first();

        return $item === null ? null : [
            'key' => $item['key'],
            'type' => $item['type'],
            'priority' => $item['priority'],
            'street' => $item['street'],
            'municipality' => $item['municipality'],
            'contributor' => $item['contributor']['name'] ?? null,
            'reports' => $item['flags']['reports'] ?? null,
            'waiting_since' => $item['waiting_since'],
            'url' => route("app.moderation.{$item['type']}s.show", $item['route']),
        ];
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function sourcesNeedingAttention(SourceOverview $sources, bool $managesSources): array
    {
        $attention = $managesSources ? $sources->rows()->whereIn('status', SourceOverview::ATTENTION)->values() : collect();

        return [
            'total' => $attention->count(),
            'items' => $attention->take(self::ATTENTION_PREVIEW)->map(fn (array $source) => [
                'id' => $source['id'],
                'name' => $source['name'],
                'status' => $source['status'],
                'import_id' => $source['status'] === 'awaiting_review' ? ($source['latest_import']['id'] ?? null) : null,
                'since' => $source['latest_import']['retrieved_at'] ?? $source['latest_delivery']['created_at'] ?? null,
            ])->values()->all(),
        ];
    }

    /**
     * Official rule links the last check could not open; people would otherwise follow them from their dashboard.
     *
     * @return array{total: int, items: list<array{id: int, name: ?string, failing_since: ?string}>}
     */
    private function brokenRuleLinks(bool $managesRules): array
    {
        if (! $managesRules) {
            return ['total' => 0, 'items' => []];
        }
        $broken = ParkingRule::query()->where('link_status', RuleLinkStatus::BROKEN);

        return [
            'total' => (clone $broken)->count(),
            'items' => $broken->with(['country:id,name', 'municipality:id,name'])->orderBy('link_failing_since')->orderBy('id')
                ->limit(self::ATTENTION_PREVIEW)->get()
                ->map(fn (ParkingRule $rule) => [
                    'id' => $rule->id,
                    'name' => $rule->nationwide ? $rule->country?->name : $rule->municipality?->name,
                    'failing_since' => $rule->link_failing_since?->toIso8601String(),
                ])->all(),
        ];
    }
}
