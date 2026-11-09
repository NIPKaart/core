<?php

namespace App\Services;

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Enums\ReportResolution;
use App\Enums\UnderSign;
use App\Models\LocationProposalDecision;
use App\Models\ParkingPlaceRemoval;
use App\Models\ParkingPlaceReport;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceImprovement;
use App\Models\ParkingSpaceReview;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Query\Builder;
use Illuminate\Pagination\LengthAwarePaginator as Paginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Decided community moderation items, most recent first: submissions approved or rejected, improvements decided,
 * and reported places kept or removed.
 *
 * Each kind keeps its own decision record; one union orders and pages them before each page is hydrated per kind.
 */
final class ModerationHistory
{
    private const string KEPT = 'kept';

    private const string REMOVAL = 'removal';

    public function __construct(private ModerationQueue $queue, private ParkingSpaceImprovements $improvements, private LocationProposalQueue $proposals) {}

    public function typesFor(User $user): array
    {
        $types = $this->queue->typesFor($user);

        return in_array(ModerationQueue::SUBMISSION, $types, true) && $user->can('bulkUpdate', ParkingSpace::class)
            ? [...$types, LocationProposalDecisions::TYPE]
            : $types;
    }

    /**
     * @param  array{types?: list<string>}  $filters
     */
    public function page(User $user, array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        $types = $this->typesFor($user);
        if (($filters['types'] ?? []) !== []) {
            $types = array_values(array_intersect($types, $filters['types']));
        }

        $decisions = collect([
            in_array(LocationProposalDecisions::TYPE, $types, true) ? DB::table('location_proposal_decisions')
                ->selectRaw("'proposal' as kind, id::text as ref, decided_at, 0 as reports") : null,
            in_array(ModerationQueue::SUBMISSION, $types, true) ? $this->submissionDecisions() : null,
            in_array(ModerationQueue::IMPROVEMENT, $types, true) ? $this->improvementDecisions() : null,
            in_array(ModerationQueue::REPORT, $types, true) ? $this->removals() : null,
            in_array(ModerationQueue::REPORT, $types, true) ? $this->keptPlaces() : null,
        ])->filter();

        if ($decisions->isEmpty()) {
            return new Paginator([], 0, $perPage);
        }

        $union = $decisions->reduce(fn (?Builder $union, Builder $query) => $union?->unionAll($query) ?? $query);
        $page = DB::query()->fromSub($union, 'decisions')
            ->orderByDesc('decided_at')->orderBy('kind')->orderByDesc('ref')
            ->paginate($perPage)
            ->withQueryString();

        $rows = $this->hydrate(collect($page->items()));
        $page->setCollection($rows);

        return $page;
    }

    /**
     * How many decisions the user took since a moment, by outcome: submissions and improvements are approved or
     * rejected, a reported place is kept or removed once however many reports it had.
     *
     * @return array{total: int, approved: int, rejected: int, reports: int}
     */
    public function countsBy(User $user, CarbonInterface $since): array
    {
        $types = $this->typesFor($user);
        $handles = fn (string $type) => in_array($type, $types, true);
        $submissions = $handles(ModerationQueue::SUBMISSION)
            ? DB::table('parking_space_reviews')->where('from_status', ParkingStatus::PENDING->value)
                ->whereIn('to_status', [ParkingStatus::APPROVED->value, ParkingStatus::REJECTED->value])
                ->where('reviewed_by', $user->id)->where('reviewed_at', '>=', $since)
                ->selectRaw('to_status as outcome, count(*) as total')->groupBy('to_status')->pluck('total', 'outcome')
            : collect();
        $improvements = $handles(ModerationQueue::IMPROVEMENT)
            ? DB::table('parking_space_improvements')->whereIn('status', [ParkingStatus::APPROVED->value, ParkingStatus::REJECTED->value])
                ->where('reviewed_by', $user->id)->where('reviewed_at', '>=', $since)
                ->selectRaw('status as outcome, count(*) as total')->groupBy('status')->pluck('total', 'outcome')
            : collect();
        $reports = $handles(ModerationQueue::REPORT)
            ? DB::table('parking_place_removals')->where('removed_by', $user->id)->where('removed_at', '>=', $since)->count()
                + DB::query()->fromSub(DB::table('parking_place_reports')->selectRaw('1')
                    ->where('resolution', ReportResolution::KEPT->value)->where('resolved_by', $user->id)->where('resolved_at', '>=', $since)
                    ->groupByRaw('coalesce(parking_space_id::text, parking_municipal_id), resolved_at'), 'kept')->count()
            : 0;
        $sum = fn (string $outcome) => (int) ($submissions[$outcome] ?? 0) + (int) ($improvements[$outcome] ?? 0);
        $proposals = $handles(LocationProposalDecisions::TYPE)
            ? DB::table('location_proposal_decisions')->where('moderator_id', $user->id)->where('decided_at', '>=', $since)
                ->selectRaw('outcome, count(*) as total')->groupBy('outcome')->pluck('total', 'outcome')
            : collect();
        $approved = $sum(ParkingStatus::APPROVED->value) + (int) ($proposals['completed'] ?? 0);
        $rejected = $sum(ParkingStatus::REJECTED->value) + (int) ($proposals['rejected'] ?? 0);

        return ['total' => $approved + $rejected + $reports, 'approved' => $approved, 'rejected' => $rejected, 'reports' => $reports];
    }

    private function submissionDecisions(): Builder
    {
        return DB::table('parking_space_reviews')
            ->selectRaw("'".ModerationQueue::SUBMISSION."' as kind, id::text as ref, reviewed_at as decided_at, 0 as reports")
            ->where('from_status', ParkingStatus::PENDING->value)
            ->whereIn('to_status', [ParkingStatus::APPROVED->value, ParkingStatus::REJECTED->value]);
    }

    private function improvementDecisions(): Builder
    {
        return DB::table('parking_space_improvements')
            ->selectRaw("'".ModerationQueue::IMPROVEMENT."' as kind, id::text as ref, reviewed_at as decided_at, 0 as reports")
            ->whereIn('status', [ParkingStatus::APPROVED->value, ParkingStatus::REJECTED->value]);
    }

    private function removals(): Builder
    {
        return DB::table('parking_place_removals')
            ->selectRaw("'".self::REMOVAL."' as kind, id::text as ref, removed_at as decided_at, open_reports as reports");
    }

    /**
     * A kept place closes all its open reports at once, so the reports closed together form one decision.
     */
    private function keptPlaces(): Builder
    {
        return DB::table('parking_place_reports')
            ->selectRaw("'".self::KEPT."' as kind, min(id)::text as ref, resolved_at as decided_at, count(*) as reports")
            ->where('resolution', ReportResolution::KEPT->value)
            ->groupByRaw('coalesce(parking_space_id::text, parking_municipal_id), resolved_at');
    }

    /**
     * @param  Collection<int, object{kind: string, ref: string, decided_at: string}>  $decisions
     * @return Collection<int, array<string, mixed>>
     */
    private function hydrate(Collection $decisions): Collection
    {
        $refs = fn (string $kind) => $decisions->where('kind', $kind)->pluck('ref')->map(fn (string $ref) => (int) $ref)->all();

        $rows = collect()
            ->concat($this->submissionRows($refs(ModerationQueue::SUBMISSION)))
            ->concat($this->improvementRows($refs(ModerationQueue::IMPROVEMENT)))
            ->concat($this->removalRows($refs(self::REMOVAL)))
            ->concat($this->keptRows($refs(self::KEPT)))
            ->concat($this->proposalRows($refs(LocationProposalDecisions::TYPE)))
            ->keyBy('key');

        return $decisions
            ->map(fn (object $decision) => ($row = $rows->get("{$decision->kind}:{$decision->ref}")) === null
                ? null
                : [...$row, 'reports' => (int) $decision->reports ?: null])
            ->filter()
            ->values();
    }

    /** @param list<int> $ids */
    private function proposalRows(array $ids): Collection
    {
        $decisions = LocationProposalDecision::whereKey($ids)->with('moderator:id,name')->get();
        $spaceIds = $decisions->flatMap(fn (LocationProposalDecision $decision) => [
            ...array_column($decision->evidence['bays'], 'id'), $decision->existing_parking_space_id,
        ])->filter()->unique();
        $spaces = ParkingSpace::whereKey($spaceIds->all())->where('status', ParkingStatus::APPROVED)
            ->get(['id', 'street', 'latitude', 'longitude'])->keyBy('id');
        $activeProposals = $this->proposals->activePoints()
            ->whereIn('point.location_proposal_id', $decisions->pluck('location_proposal_id'))
            ->distinct()->pluck('point.location_proposal_id')->flip();
        $current = DB::table('location_proposal_decisions')->whereIn('location_proposal_id', $decisions->pluck('location_proposal_id'))
            ->groupBy('location_proposal_id')->selectRaw('location_proposal_id, max(id) as id')->pluck('id', 'location_proposal_id');
        $closed = DB::table('location_proposals')->whereIn('id', $decisions->pluck('location_proposal_id'))
            ->whereNotNull('closed_at')->pluck('decision_revision', 'id');

        return $decisions->map(function (LocationProposalDecision $decision) use ($spaces, $activeProposals, $current, $closed): array {
            $evidence = $decision->evidence;
            $proposal = $decision->location_proposal_id;
            $map = function (?string $id) use ($spaces): ?string {
                $space = $spaces->get($id);

                return $space === null ? null : route('location-map', [
                    'place' => "community:{$space->id}", 'at' => "{$space->latitude},{$space->longitude}",
                ]);
            };

            return [
                'key' => LocationProposalDecisions::TYPE.":{$decision->id}",
                'type' => LocationProposalDecisions::TYPE,
                'decision' => $decision->outcome,
                'street' => $evidence['street'] ?? null,
                'municipality' => $evidence['municipality'] ?? null,
                'contributor' => null,
                'reason' => $decision->reason?->label(),
                'note' => $decision->note,
                'reviewer' => $decision->moderator?->name,
                'decided_at' => $decision->decided_at,
                'proposal' => [
                    'id' => $proposal,
                    'reopen_revision' => $activeProposals->has($proposal) && $current->get($proposal) === $decision->id ? $closed->get($proposal) : null,
                    'source' => $evidence['source'] ?? null,
                    'last_seen_on' => $evidence['last_seen_on'] ?? null,
                    'reported_bays' => $evidence['reported_bays'] ?? null,
                    'total_bays' => $evidence['total_bays'] ?? count($evidence['bays']),
                    'orientation' => ParkingOrientation::tryFrom($evidence['orientation'] ?? '')?->label(),
                    'under_sign' => UnderSign::tryFrom($evidence['under_sign'] ?? '')?->label(),
                    'restriction' => $evidence['restriction'] ?? null,
                    'parking_time' => $evidence['parking_time'] ?? null,
                    'restriction_days' => $evidence['restriction_days'] ?? null,
                    'restriction_starts_at' => $evidence['restriction_starts_at'] ?? null,
                    'restriction_ends_at' => $evidence['restriction_ends_at'] ?? null,
                    'bays' => array_map(fn (array $bay): array => [...$bay, 'url' => $map($bay['id'])], $evidence['bays']),
                    'existing_url' => $map($decision->existing_parking_space_id),
                ],
            ];
        });
    }

    /**
     * @param  list<int>  $ids
     * @return Collection<int, array<string, mixed>>
     */
    private function submissionRows(array $ids): Collection
    {
        return ParkingSpaceReview::whereKey($ids)
            ->with(['reviewer:id,name', 'parkingSpace' => fn ($space) => $space->withTrashed()->with(['municipality:id,name', 'user:id,name'])])
            ->get()
            ->map(fn (ParkingSpaceReview $review) => [
                'key' => ModerationQueue::SUBMISSION.":{$review->id}",
                'type' => ModerationQueue::SUBMISSION,
                'decision' => $review->to_status->value,
                'street' => $review->parkingSpace?->street,
                'municipality' => $review->parkingSpace?->municipality?->name,
                'contributor' => $review->parkingSpace?->user?->name,
                'reason' => $review->reason?->label(),
                'note' => $review->note,
                'reviewer' => $review->reviewer?->name,
                'decided_at' => $review->reviewed_at,
            ]);
    }

    /**
     * @param  list<int>  $ids
     * @return Collection<int, array<string, mixed>>
     */
    private function improvementRows(array $ids): Collection
    {
        return $this->improvements->decided(ParkingSpaceImprovement::whereKey($ids)->get())
            ->map(fn (array $row) => [
                ...$row,
                'key' => ModerationQueue::IMPROVEMENT.":{$row['id']}",
                'type' => ModerationQueue::IMPROVEMENT,
                'decision' => $row['status'],
                'street' => $row['space']['street'],
                'municipality' => $row['space']['municipality'],
                'contributor' => $row['proposer'],
                'decided_at' => $row['reviewed_at'],
            ]);
    }

    /**
     * @param  list<int>  $ids
     * @return Collection<int, array<string, mixed>>
     */
    private function removalRows(array $ids): Collection
    {
        return ParkingPlaceRemoval::whereKey($ids)->with('remover:id,name')->get()
            ->map(fn (ParkingPlaceRemoval $removal) => [
                'key' => self::REMOVAL.":{$removal->id}",
                'type' => ModerationQueue::REPORT,
                'decision' => 'removed',
                'source' => $removal->source,
                'street' => $removal->place_label,
                'municipality' => null,
                'contributor' => null,
                'reason' => $removal->reason->label(),
                'note' => $removal->note,
                'reviewer' => $removal->remover?->name,
                'decided_at' => $removal->removed_at,
            ]);
    }

    /**
     * @param  list<int>  $ids
     * @return Collection<int, array<string, mixed>>
     */
    private function keptRows(array $ids): Collection
    {
        return ParkingPlaceReport::whereKey($ids)
            ->with(['resolver:id,name', 'parkingSpace' => fn ($space) => $space->withTrashed()->with('municipality:id,name'), 'parkingMunicipal.municipality:id,name'])
            ->get()
            ->map(function (ParkingPlaceReport $report) {
                $place = $report->parkingSpace ?? $report->parkingMunicipal;

                return [
                    'key' => self::KEPT.":{$report->id}",
                    'type' => ModerationQueue::REPORT,
                    'decision' => self::KEPT,
                    'source' => $report->parking_space_id ? 'community' : 'municipal',
                    'street' => $place?->street,
                    'municipality' => $place?->municipality?->name,
                    'contributor' => null,
                    'reason' => null,
                    'note' => null,
                    'reviewer' => $report->resolver?->name,
                    'decided_at' => $report->resolved_at,
                ];
            });
    }
}
