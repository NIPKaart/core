<?php

namespace App\Services;

use App\Enums\LocationProposalDecisionReason;
use App\Events\ModerationQueueChanged;
use App\Models\LocationProposalDecision;
use App\Models\ParkingMunicipal;
use App\Models\ParkingSpace;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class LocationProposalDecisions
{
    public const string TYPE = 'proposal';

    public function checkRevision(object $proposal, int $revision): void
    {
        if ($proposal->decision_revision !== $revision) {
            throw ValidationException::withMessages(['decision' => __('parking_spaces.proposal.changed')]);
        }
    }

    /** @param list<ParkingSpace> $bays */
    public function record(
        object $proposal,
        object $point,
        User $moderator,
        CarbonInterface $decidedAt,
        ?LocationProposalDecisionReason $reason,
        ?string $note,
        array $bays = [],
        int $total = 0,
        ParkingSpace|ParkingMunicipal|null $existing = null,
    ): void {
        $first = $bays[0] ?? null;
        LocationProposalDecision::create([
            'location_proposal_id' => $proposal->id,
            'moderator_id' => $moderator->id,
            'decided_at' => $decidedAt,
            'outcome' => $bays === [] ? 'rejected' : 'completed',
            'reason' => $reason,
            'note' => $note,
            'existing_parking_space_id' => $existing instanceof ParkingSpace ? $existing->id : null,
            'existing_parking_municipal_id' => $existing instanceof ParkingMunicipal ? $existing->id : null,
            'evidence' => [
                'street' => $first?->street ?? $existing?->street,
                'existing_id' => $existing?->id,
                ...($existing === null ? [] : ['marker_distance_metres' => round((float) $existing->distance_metres, 2)]),
                'existing_source' => match (true) {
                    $existing instanceof ParkingSpace => 'community',
                    $existing instanceof ParkingMunicipal => 'municipal',
                    default => null,
                },
                'municipality' => $point->municipality,
                'source' => $point->source,
                'last_seen_on' => $point->source_last_seen_on,
                'total_bays' => $total,
                'orientation' => $first?->orientation?->value,
                'under_sign' => $first?->under_sign?->value,
                'restriction' => $first?->under_sign_text,
                'parking_time' => $first?->parking_time,
                'restriction_days' => $first?->restriction_days,
                'restriction_starts_at' => $first?->restriction_starts_at,
                'restriction_ends_at' => $first?->restriction_ends_at,
                'bays' => array_map(fn (ParkingSpace $bay): array => ['id' => $bay->id, 'number' => $bay->location_proposal_bay_number], $bays),
            ],
        ]);

        ModerationQueueChanged::dispatch('decided');
        DB::table('location_proposals')->where('id', $proposal->id)->update([
            'closed_at' => $decidedAt,
            'decision_revision' => $proposal->decision_revision + 1,
            ...($bays === [] ? [] : ['bays_published_at' => $decidedAt]),
        ]);
    }
}
