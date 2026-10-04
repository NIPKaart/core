<?php

namespace App\Services;

use App\Enums\ParkingStatus;
use App\Models\ParkingPlaceReport;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceImprovement;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * The one queue of community decisions a moderator works through: new submissions, proposed improvements and
 * reports that a published place no longer exists.
 *
 * Priority follows public impact only: reports concern information the map already shows and come first, the rest is
 * normal. Within a priority the item that has waited longest comes first. What is known about a contributor is shown
 * as context and never changes the order. Each person sees only the kinds of items they may moderate.
 */
final class ModerationQueue
{
    public const string SUBMISSION = 'submission';

    public const string IMPROVEMENT = 'improvement';

    public const string REPORT = 'report';

    public const array TYPES = [self::SUBMISSION, self::IMPROVEMENT, self::REPORT];

    public function __construct(
        private ParkingSpaceImprovements $improvements,
        private ParkingPlaceModeration $reports,
        private NearbyMunicipalPlaces $nearbyMunicipalPlaces,
    ) {}

    /**
     * The kinds of items the user may see in the queue.
     *
     * @return list<string>
     */
    public function typesFor(User $user): array
    {
        return array_values(array_filter([
            $user->can('viewAny', ParkingSpace::class) ? self::SUBMISSION : null,
            $user->can('viewAny', ParkingSpaceImprovement::class) ? self::IMPROVEMENT : null,
            $user->can('viewAny', ParkingPlaceReport::class) ? self::REPORT : null,
        ]));
    }

    /**
     * The open items the user may see, in the order to work through them.
     *
     * The queue is small enough to assemble in memory, as the report queue already does.
     *
     * @param  array{types?: list<string>, municipality_ids?: list<int>, search?: ?string}  $filters
     * @return Collection<int, array<string, mixed>>
     */
    public function items(User $user, array $filters = []): Collection
    {
        $types = $this->typesFor($user);
        if (($filters['types'] ?? []) !== []) {
            $types = array_values(array_intersect($types, $filters['types']));
        }

        $items = collect()
            ->concat(in_array(self::SUBMISSION, $types, true) ? $this->submissions() : [])
            ->concat(in_array(self::IMPROVEMENT, $types, true) ? $this->improvementItems() : [])
            ->concat(in_array(self::REPORT, $types, true) ? $this->reportItems() : []);

        return $this->filter($items, $filters)
            ->sort(fn (array $a, array $b) => [$a['priority'] === 'high' ? 0 : 1, $a['waiting_since'], $a['key']]
                <=> [$b['priority'] === 'high' ? 0 : 1, $b['waiting_since'], $b['key']])
            ->values();
    }

    /**
     * Where an item sits in a queue built by items(), and its neighbours there.
     *
     * @param  Collection<int, array<string, mixed>>  $items
     * @return array{index: int, total: int, previous: ?array<string, mixed>, next: ?array<string, mixed>}
     */
    public function position(Collection $items, string $key): array
    {
        $index = $items->search(fn (array $item) => $item['key'] === $key);

        if ($index === false) {
            return ['index' => 0, 'total' => $items->count(), 'previous' => null, 'next' => $items->first()];
        }

        return [
            'index' => $index + 1,
            'total' => $items->count(),
            'previous' => $items->get($index - 1),
            'next' => $items->get($index + 1),
        ];
    }

    /**
     * The item to review once this one is decided: the next in the queue, else the one before it.
     *
     * Call it before deciding, while the item still has its place in the queue.
     *
     * @param  array{types?: list<string>, municipality_ids?: list<int>, search?: ?string}  $filters
     * @return ?array<string, mixed>
     */
    public function after(User $user, string $key, array $filters = []): ?array
    {
        $position = $this->position($this->items($user, $filters), $key);

        return $position['index'] === 0 ? null : ($position['next'] ?? $position['previous']);
    }

    /**
     * The number of open items in the user's queue, for the navigation badge; cheap enough for every request.
     */
    public function count(User $user): int
    {
        $types = $this->typesFor($user);

        return (in_array(self::SUBMISSION, $types, true) ? ParkingSpace::where('status', ParkingStatus::PENDING)->count() : 0)
            + (in_array(self::IMPROVEMENT, $types, true) ? $this->improvements->pendingCount() : 0)
            + (in_array(self::REPORT, $types, true) ? $this->reports->openPlaceCount() : 0);
    }

    /**
     * The queue at a glance, for pointing someone to it: how much waits, how urgent and since when.
     *
     * Counted with aggregates rather than by building the queue; reports are the only high-priority items.
     *
     * @return array{total: int, high: int, types: array<string, int>, oldest: ?string}
     */
    public function summary(User $user): array
    {
        $types = $this->typesFor($user);
        $waiting = collect([
            self::SUBMISSION => fn () => ParkingSpace::where('status', ParkingStatus::PENDING)
                ->selectRaw('count(*) as total, min(created_at) as oldest')->toBase()->first(),
            self::IMPROVEMENT => fn () => ParkingSpaceImprovement::pending()->whereHas('parkingSpace')
                ->selectRaw('count(*) as total, min(created_at) as oldest')->toBase()->first(),
            self::REPORT => fn () => (object) [
                'total' => $this->reports->openPlaceCount(),
                'oldest' => ParkingPlaceReport::open()
                    ->where(fn (Builder $reports) => $reports->whereNull('parking_space_id')->orWhereHas('parkingSpace'))
                    ->min('created_at'),
            ],
        ])->only($types)->map(fn (callable $count) => $count());

        $oldest = $waiting->pluck('oldest')->filter()->map(fn (mixed $at) => Carbon::parse($at))->min();

        return [
            'total' => (int) $waiting->sum('total'),
            'high' => (int) ($waiting->get(self::REPORT)?->total ?? 0),
            'types' => $waiting->map(fn (object $row) => (int) $row->total)->filter()->all(),
            'oldest' => $oldest?->toIso8601String(),
        ];
    }

    public static function submissionKey(string $id): string
    {
        return self::SUBMISSION.":{$id}";
    }

    public static function improvementKey(int $id): string
    {
        return self::IMPROVEMENT.":{$id}";
    }

    public static function reportKey(string $source, string $id): string
    {
        return self::REPORT.":{$source}:{$id}";
    }

    /**
     * Pending community submissions, with how close a visible municipal place lies.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function submissions(): Collection
    {
        return $this->nearbyMunicipalPlaces->withNearbyDistance(ParkingSpace::query())
            ->where('status', ParkingStatus::PENDING)
            ->with(['municipality:id,name', 'user' => fn ($user) => $user->select('id', 'name', 'created_at')->withCount([
                'parkingSpaces as approved_spaces' => fn (Builder $spaces) => $spaces->where('status', ParkingStatus::APPROVED),
                'parkingSpaces as rejected_spaces' => fn (Builder $spaces) => $spaces->where('status', ParkingStatus::REJECTED),
            ])])
            ->get()
            ->map(fn (ParkingSpace $space) => [
                ...$this->item(self::SUBMISSION, self::submissionKey($space->id), 'normal', $space->created_at),
                'route' => ['parking_space' => $space->id],
                'street' => $space->street,
                'municipality' => $space->municipality?->name,
                'municipality_id' => $space->municipality_id,
                'contributor' => [
                    'name' => $space->user?->name,
                    'approved' => (int) ($space->user->approved_spaces ?? 0),
                    'rejected' => (int) ($space->user->rejected_spaces ?? 0),
                    'is_new' => $space->user !== null && $space->user->created_at->gt(now()->subDays(ParkingSpaceImprovements::NEW_ACCOUNT_DAYS)),
                ],
                'flags' => ['nearby_municipal_metres' => $space->nearby_municipal_metres],
            ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function improvementItems(): Collection
    {
        return $this->improvements->open()->map(fn (array $row) => [
            ...$this->item(self::IMPROVEMENT, self::improvementKey($row['id']), 'normal', $row['submitted_at']),
            'route' => ['improvement' => $row['id']],
            'street' => $row['space']['street'],
            'municipality' => $row['space']['municipality'],
            'municipality_id' => $row['space']['municipality_id'],
            'contributor' => $row['proposer'],
            'changes' => $row['changes'],
            'distance_metres' => $row['distance_metres'],
            'flags' => $row['flags'],
        ]);
    }

    /**
     * Reported places, one item per place however many reports it has; they wait since the first open report.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function reportItems(): Collection
    {
        return $this->reports->queue()->map(fn (array $row) => [
            ...$this->item(self::REPORT, self::reportKey($row['source'], (string) $row['id']), 'high', $row['first_reported_at']),
            'route' => ['source' => $row['source'], 'id' => $row['id']],
            'source' => $row['source'],
            'street' => $row['street'],
            'municipality' => $row['municipality'],
            'municipality_id' => $row['municipality_id'],
            'contributor' => null,
            'flags' => ['reports' => count($row['reports'])],
        ]);
    }

    /**
     * @return array{type: string, key: string, priority: string, waiting_since: string}
     */
    private function item(string $type, string $key, string $priority, Carbon $waitingSince): array
    {
        return ['type' => $type, 'key' => $key, 'priority' => $priority, 'waiting_since' => $waitingSince->toIso8601String()];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $items
     * @param  array{municipality_ids?: list<int>, search?: ?string}  $filters
     * @return Collection<int, array<string, mixed>>
     */
    private function filter(Collection $items, array $filters): Collection
    {
        if (($filters['municipality_ids'] ?? []) !== []) {
            $items = $items->filter(fn (array $item) => in_array($item['municipality_id'], $filters['municipality_ids'], true));
        }

        $term = mb_strtolower(trim($filters['search'] ?? ''));
        if ($term !== '') {
            $items = $items->filter(fn (array $item) => collect([$item['street'], $item['municipality'], $item['contributor']['name'] ?? null])
                ->filter()
                ->contains(fn (string $value) => str_contains(mb_strtolower($value), $term)));
        }

        return $items;
    }
}
