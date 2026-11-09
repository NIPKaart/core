<?php

namespace App\Services;

use App\Enums\ParkingStatus;
use App\Models\Municipality;
use App\Models\ParkingPlaceReport;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceImprovement;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

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
     * One page of the open items the user may see, in the order to work through them.
     *
     * The order, filters and paging run in one database query over all open items; only the items on the page are
     * built in full. A page past the end shows the last page.
     *
     * @param  array{types?: list<string>, municipality_ids?: list<int>, search?: ?string}  $filters
     */
    public function page(User $user, array $filters = [], int $page = 1, int $perPage = 50): LengthAwarePaginator
    {
        $index = $this->index($user, $filters);
        $total = DB::query()->fromSub($index, 'queue')->count();
        $page = min(max(1, $page), max(1, (int) ceil($total / $perPage)));
        $rows = $this->ordered(DB::query()->fromSub($index, 'queue'))->forPage($page, $perPage)->get();

        return new LengthAwarePaginator($this->hydrate($rows), $total, $perPage, $page);
    }

    /**
     * One open item in full, when the user may see it.
     *
     * @return ?array<string, mixed>
     */
    public function item(User $user, string $key): ?array
    {
        return $this->hydrate(DB::query()->fromSub($this->index($user), 'queue')->where('item_key', $key)->get())->first();
    }

    /**
     * Where an item sits in the queue, and links to its neighbours there.
     *
     * An item outside these filters has no place; then the queue's first item is next.
     *
     * @param  array{types?: list<string>, municipality_ids?: list<int>, search?: ?string}  $filters
     * @return array{index: int, total: int, previous: ?array<string, mixed>, next: ?array<string, mixed>}
     */
    public function position(User $user, string $key, array $filters = []): array
    {
        $index = $this->index($user, $filters);
        $numbered = DB::query()->fromSub($index, 'queue')->select('queue.*')
            ->selectRaw('row_number() over (order by priority, waiting_since, item_key collate "C") as position');
        $total = DB::query()->fromSub($index, 'queue')->count();
        $position = (int) DB::query()->fromSub($numbered, 'numbered')->where('item_key', $key)->value('position');

        $at = fn (int $position) => $position < 1 ? null : $this->link(DB::query()->fromSub($numbered, 'numbered')->where('position', $position)->first());

        return $position === 0
            ? ['index' => 0, 'total' => $total, 'previous' => null, 'next' => $at(1)]
            : ['index' => $position, 'total' => $total, 'previous' => $at($position - 1), 'next' => $at($position + 1)];
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
        $position = $this->position($user, $key, $filters);

        return $position['index'] === 0 ? null : ($position['next'] ?? $position['previous']);
    }

    /**
     * The municipalities with open items, to filter the queue by.
     *
     * @return Collection<int, Municipality>
     */
    public function municipalities(User $user): Collection
    {
        return Municipality::whereIn('id', DB::query()->fromSub($this->index($user), 'queue')->whereNotNull('municipality_id')->select('municipality_id'))
            ->orderBy('name')->get(['id', 'name']);
    }

    /**
     * The country of an item, else the country most of the filtered queue lies in, for the aerial photo.
     *
     * @param  array{types?: list<string>, municipality_ids?: list<int>, search?: ?string}  $filters
     */
    public function country(User $user, array $filters = [], ?string $key = null): ?string
    {
        $countryOf = fn (QueryBuilder $index) => DB::query()->fromSub($index, 'queue')
            ->join('municipalities', 'municipalities.id', '=', 'queue.municipality_id')
            ->join('countries', 'countries.id', '=', 'municipalities.country_id')
            ->groupBy('countries.code')->orderByRaw('count(*) desc')->orderBy('countries.code')
            ->value('countries.code');

        return ($key === null ? null : $countryOf($this->index($user)->where('item_key', $key)))
            ?? $countryOf($this->index($user, $filters));
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
     * Every open item the user may see, as one row each with what the order and filters need.
     *
     * @param  array{types?: list<string>, municipality_ids?: list<int>, search?: ?string}  $filters
     */
    private function index(User $user, array $filters = []): QueryBuilder
    {
        $types = $this->typesFor($user);
        if (($filters['types'] ?? []) !== []) {
            $types = array_values(array_intersect($types, $filters['types']));
        }

        $parts = array_values(array_filter([
            in_array(self::SUBMISSION, $types, true) ? $this->submissionIndex() : null,
            in_array(self::IMPROVEMENT, $types, true) ? $this->improvementIndex() : null,
            ...(in_array(self::REPORT, $types, true) ? $this->reportIndex() : []),
        ]));
        if ($parts === []) {
            return DB::query()->fromRaw('(select null::text as item_key, null::text as kind, null::text as source, null::text as ref, 0 as priority, null::timestamp as waiting_since, null::bigint as municipality_id, null::text as street, null::text as municipality, null::text as contributor) as nothing')->whereRaw('false');
        }

        $union = array_reduce(array_slice($parts, 1), fn (QueryBuilder $union, QueryBuilder $part) => $union->unionAll($part), $parts[0]);
        $query = DB::query()->fromSub($union, 'items');

        if (($filters['municipality_ids'] ?? []) !== []) {
            $query->whereIn('municipality_id', $filters['municipality_ids']);
        }

        $term = trim($filters['search'] ?? '');
        if ($term !== '') {
            $like = '%'.addcslashes(mb_strtolower($term), '\\%_').'%';
            $query->where(fn (QueryBuilder $search) => $search
                ->whereRaw('lower(street) like ?', [$like])
                ->orWhereRaw('lower(municipality) like ?', [$like])
                ->orWhereRaw('lower(contributor) like ?', [$like]));
        }

        return $query;
    }

    private function ordered(QueryBuilder $query): QueryBuilder
    {
        return $query->orderBy('priority')->orderBy('waiting_since')->orderByRaw('item_key collate "C"');
    }

    private function submissionIndex(): QueryBuilder
    {
        return ParkingSpace::query()
            ->leftJoin('municipalities', 'municipalities.id', '=', 'parking_spaces.municipality_id')
            ->leftJoin('users', 'users.id', '=', 'parking_spaces.user_id')
            ->where('parking_spaces.status', ParkingStatus::PENDING)
            ->selectRaw("'".self::SUBMISSION.":' || parking_spaces.id as item_key, '".self::SUBMISSION."' as kind, null::text as source, parking_spaces.id::text as ref")
            ->selectRaw('1 as priority, parking_spaces.created_at as waiting_since, parking_spaces.municipality_id, parking_spaces.street')
            ->selectRaw('municipalities.name as municipality, users.name as contributor')
            ->toBase();
    }

    /**
     * Open proposals for spaces that still exist; a proposal for a space in the trash waits until it is restored.
     */
    private function improvementIndex(): QueryBuilder
    {
        return ParkingSpaceImprovement::query()
            ->join('parking_spaces as space', 'space.id', '=', 'parking_space_improvements.parking_space_id')
            ->leftJoin('municipalities', 'municipalities.id', '=', 'space.municipality_id')
            ->leftJoin('users', 'users.id', '=', 'parking_space_improvements.user_id')
            ->where('parking_space_improvements.status', ParkingStatus::PENDING)
            ->whereNull('space.deleted_at')
            ->selectRaw("'".self::IMPROVEMENT.":' || parking_space_improvements.id as item_key, '".self::IMPROVEMENT."' as kind, null::text as source, parking_space_improvements.id::text as ref")
            ->selectRaw('1 as priority, parking_space_improvements.created_at as waiting_since, space.municipality_id, space.street')
            ->selectRaw('municipalities.name as municipality, users.name as contributor')
            ->toBase();
    }

    /**
     * Reported places, one row per place however many open reports it has; they wait since the first one.
     *
     * @return list<QueryBuilder>
     */
    private function reportIndex(): array
    {
        $place = fn (string $source, string $table, string $foreignKey, bool $softDeletes) => DB::table('parking_place_reports as report')
            ->join("{$table} as place", 'place.id', '=', "report.{$foreignKey}")
            ->leftJoin('municipalities', 'municipalities.id', '=', 'place.municipality_id')
            ->whereNull('report.resolved_at')
            ->when($softDeletes, fn (QueryBuilder $query) => $query->whereNull('place.deleted_at'))
            ->groupBy('place.id', 'place.municipality_id', 'place.street', 'municipalities.name')
            ->selectRaw("'".self::REPORT.":{$source}:' || place.id as item_key, '".self::REPORT."' as kind, '{$source}' as source, place.id::text as ref")
            ->selectRaw('0 as priority, min(report.created_at) as waiting_since, place.municipality_id, place.street')
            ->selectRaw('municipalities.name as municipality, null::text as contributor');

        return [
            $place('community', 'parking_spaces', 'parking_space_id', true),
            $place('municipal', 'parking_municipal_spaces', 'parking_municipal_id', false),
        ];
    }

    /**
     * The index rows built in full, in the same order, with each contributor's community points.
     *
     * @param  Collection<int, object>  $rows
     * @return Collection<int, array<string, mixed>>
     */
    private function hydrate(Collection $rows): Collection
    {
        $refs = fn (string $kind, ?string $source = null) => $rows->where('kind', $kind)->where('source', $source)->pluck('ref')->all();

        $items = collect()
            ->concat($refs(self::SUBMISSION) === [] ? [] : $this->submissions($refs(self::SUBMISSION)))
            ->concat($refs(self::IMPROVEMENT) === [] ? [] : $this->improvementItems(array_map('intval', $refs(self::IMPROVEMENT))))
            ->concat($rows->where('kind', self::REPORT)->isEmpty() ? [] : $this->reportItems([
                'community' => $refs(self::REPORT, 'community'),
                'municipal' => $refs(self::REPORT, 'municipal'),
            ]))
            ->keyBy('key');

        $profiles = app(CommunityPoints::class)->profiles($items->pluck('contributor.id')->filter()->unique()->values()->all());

        return $rows->map(function (object $row) use ($items, $profiles): ?array {
            $item = $items->get($row->item_key);
            if ($item !== null && $item['contributor'] !== null) {
                $item['contributor']['community_points'] = $profiles[$item['contributor']['id']] ?? null;
                unset($item['contributor']['id']);
            }

            return $item;
        })->filter()->values();
    }

    /**
     * The address of an index row, enough to link to it.
     *
     * @return ?array{key: string, type: string, route: array<string, int|string>, street: ?string}
     */
    private function link(?object $row): ?array
    {
        return $row === null ? null : [
            'key' => $row->item_key,
            'type' => $row->kind,
            'route' => match ($row->kind) {
                self::SUBMISSION => ['parking_space' => $row->ref],
                self::IMPROVEMENT => ['improvement' => (int) $row->ref],
                self::REPORT => ['source' => $row->source, 'id' => $row->ref],
            },
            'street' => $row->street,
        ];
    }

    /**
     * Pending community submissions, with how close a visible municipal place lies.
     *
     * @param  list<string>  $ids
     * @return Collection<int, array<string, mixed>>
     */
    private function submissions(array $ids): Collection
    {
        return $this->nearbyMunicipalPlaces->withNearbyDistance(ParkingSpace::query())
            ->whereKey($ids)
            ->where('status', ParkingStatus::PENDING)
            ->with(['municipality:id,name', 'user' => fn ($user) => $user->select('id', 'name', 'created_at')->withCount([
                'parkingSpaces as approved_spaces' => fn (Builder $spaces) => $spaces->where('status', ParkingStatus::APPROVED),
                'parkingSpaces as rejected_spaces' => fn (Builder $spaces) => $spaces->where('status', ParkingStatus::REJECTED),
            ])])
            ->get()
            ->map(fn (ParkingSpace $space) => [
                ...$this->entry(self::SUBMISSION, self::submissionKey($space->id), 'normal', $space->created_at),
                'route' => ['parking_space' => $space->id],
                'street' => $space->street,
                'municipality' => $space->municipality?->name,
                'municipality_id' => $space->municipality_id,
                'latitude' => $space->latitude,
                'longitude' => $space->longitude,
                'contributor' => [
                    'id' => $space->user?->id,
                    'name' => $space->user?->name,
                    'approved' => (int) ($space->user->approved_spaces ?? 0),
                    'rejected' => (int) ($space->user->rejected_spaces ?? 0),
                    'is_new' => $space->user !== null && $space->user->created_at->gt(now()->subDays(ParkingSpaceImprovements::NEW_ACCOUNT_DAYS)),
                ],
                'flags' => ['nearby_municipal_metres' => $space->nearby_municipal_metres],
            ]);
    }

    /**
     * @param  list<int>  $ids
     * @return Collection<int, array<string, mixed>>
     */
    private function improvementItems(array $ids): Collection
    {
        return $this->improvements->open($ids)->map(fn (array $row) => [
            ...$this->entry(self::IMPROVEMENT, self::improvementKey($row['id']), 'normal', $row['submitted_at']),
            'route' => ['improvement' => $row['id']],
            'street' => $row['space']['street'],
            'municipality' => $row['space']['municipality'],
            'municipality_id' => $row['space']['municipality_id'],
            'latitude' => $row['space']['latitude'],
            'longitude' => $row['space']['longitude'],
            'contributor' => $row['proposer'],
            'changes' => $row['changes'],
            'distance_metres' => $row['distance_metres'],
            'flags' => $row['flags'],
        ]);
    }

    /**
     * Reported places, one item per place however many reports it has; they wait since the first open report.
     *
     * @param  array{community: list<string>, municipal: list<string>}  $places
     * @return Collection<int, array<string, mixed>>
     */
    private function reportItems(array $places): Collection
    {
        return $this->reports->queue($places)->map(fn (array $row) => [
            ...$this->entry(self::REPORT, self::reportKey($row['source'], (string) $row['id']), 'high', $row['first_reported_at']),
            'route' => ['source' => $row['source'], 'id' => $row['id']],
            'source' => $row['source'],
            'street' => $row['street'],
            'municipality' => $row['municipality'],
            'municipality_id' => $row['municipality_id'],
            'latitude' => $row['latitude'],
            'longitude' => $row['longitude'],
            'preview' => $this->reportPreview($row['reports']),
            'contributor' => null,
            'flags' => ['reports' => count($row['reports'])],
        ]);
    }

    /**
     * What the place's reporters said, for the queue row: the latest note, else the latest reason.
     *
     * @param  iterable<array{reason: ?string, note: ?string}>  $reports
     */
    private function reportPreview(iterable $reports): ?string
    {
        $reports = collect($reports)->reverse();

        return $reports->pluck('note')->filter()->first() ?? $reports->pluck('reason')->filter()->first();
    }

    /**
     * @return array{type: string, key: string, priority: string, waiting_since: string}
     */
    private function entry(string $type, string $key, string $priority, Carbon $waitingSince): array
    {
        return ['type' => $type, 'key' => $key, 'priority' => $priority, 'waiting_since' => $waitingSince->toIso8601String()];
    }
}
