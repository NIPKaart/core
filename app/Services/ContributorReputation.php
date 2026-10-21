<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Minimal reviewed outcomes survive removal of parking data. Account deletion removes the personal ledger.
 * One current outcome per contribution prevents retries or re-review from multiplying reputation.
 */
final class ContributorReputation
{
    public function record(?int $userId, int $reviewerId, string $kind, string $subjectId, string $outcome, ?string $reason = null): void
    {
        if ($userId === null) {
            return;
        }

        DB::table('contributor_reputation_events')->upsert([[
            'user_id' => $userId,
            'reviewed_by' => $reviewerId,
            'kind' => $kind,
            'subject_id' => $subjectId,
            'outcome' => $outcome,
            'reason' => $reason,
            'decided_at' => now(),
            'recorded_at' => now(),
        ]], ['kind', 'subject_id'], ['reviewed_by', 'outcome', 'reason', 'decided_at']);
    }

    public function rejection(string $reason): string
    {
        return match ($reason) {
            'spam' => 'spam',
            'incorrect', 'not_a_disabled_bay' => 'incorrect',
            default => 'neutral',
        };
    }

    /**
     * Internal context only. Aggregate by outcome so the cost depends on outcome kinds, not lifetime activity.
     *
     * @param  list<int>  $userIds
     * @return array<int, array{score: int, reviewed: int, outcomes: list<array{kind: string, outcome: string, reason: ?string, count: int}>, first_recorded_at: ?string, recent: list<array{kind: string, outcome: string, reason: ?string, decided_at: string}>}>
     */
    public function profiles(array $userIds): array
    {
        $profiles = [];
        foreach (array_unique($userIds) as $id) {
            $profiles[$id] = ['score' => 0, 'reviewed' => 0, 'outcomes' => [], 'first_recorded_at' => null, 'recent' => []];
        }

        $groups = DB::table('contributor_reputation_events')->whereIn('user_id', $userIds)
            ->select('user_id', 'kind', 'outcome', 'reason')
            ->selectRaw('count(*) as total, min(recorded_at) as first_recorded_at')
            ->groupBy('user_id', 'kind', 'outcome', 'reason')->orderBy('kind')->orderBy('outcome')->orderBy('reason')->get();

        foreach ($groups as $group) {
            $profile = &$profiles[$group->user_id];
            $count = (int) $group->total;
            $profile['reviewed'] += $count;
            $profile['outcomes'][] = ['kind' => $group->kind, 'outcome' => $group->outcome, 'reason' => $group->reason, 'count' => $count];
            $first = Carbon::parse($group->first_recorded_at)->toISOString();
            $profile['first_recorded_at'] = min($profile['first_recorded_at'] ?? $first, $first);
            unset($profile);
        }

        $ranked = DB::table('contributor_reputation_events')->whereIn('user_id', $userIds)
            ->select('user_id', 'kind', 'outcome', 'reason', 'decided_at')
            ->selectRaw('row_number() over (partition by user_id order by decided_at desc, id desc) as position');
        foreach (DB::query()->fromSub($ranked, 'recent')->where('position', '<=', 5)->orderBy('user_id')->orderBy('position')->get() as $event) {
            $profiles[$event->user_id]['recent'][] = ['kind' => $event->kind, 'outcome' => $event->outcome, 'reason' => $event->reason, 'decided_at' => Carbon::parse($event->decided_at)->toISOString()];
        }

        foreach ($profiles as &$profile) {
            $profile['score'] = $this->score($profile['outcomes']);
        }

        return $profiles;
    }

    /**
     * Accumulated useful value, adjusted by a smoothed quality factor. Neutral decisions are not correctness evidence.
     * Equal prior evidence prevents one approval implying perfect reliability; more reviewed history reduces its influence.
     *
     * @param  list<array{kind: string, outcome: string, reason: ?string, count: int}>  $outcomes
     */
    private function score(array $outcomes): int
    {
        $values = config('reputation.contribution_values');
        $negativeWeights = config('reputation.negative_evidence');
        $value = 0;
        $positive = 0;
        $negative = 0;

        foreach ($outcomes as $outcome) {
            if (array_key_exists($outcome['outcome'], $values)) {
                $value += $outcome['count'] * max(0, (int) $values[$outcome['outcome']]);
                $positive += $outcome['count'];
            }
            $negative += $outcome['count'] * max(0, (float) ($negativeWeights[$outcome['outcome']] ?? 0));
        }

        $prior = max(0.01, (float) config('reputation.prior_evidence'));
        $quality = ($positive + $prior) / ($positive + $negative + 2 * $prior);

        return (int) round($value * $quality, 0, PHP_ROUND_HALF_UP);
    }
}
