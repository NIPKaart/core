<?php

namespace Database\Factories;

use App\Enums\LocationProposalDecisionReason;
use App\Models\LocationProposalDecision;
use App\Models\Municipality;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\DB;

/** @extends Factory<LocationProposalDecision> */
class LocationProposalDecisionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'location_proposal_id' => fn () => DB::table('location_proposals')->insertGetId([
                'municipality_id' => Municipality::factory()->create()->id,
                'created_at' => now(),
            ]),
            'moderator_id' => User::factory(),
            'decided_at' => now(),
            'outcome' => 'rejected',
            'reason' => LocationProposalDecisionReason::NOT_A_DISABLED_BAY,
            'evidence' => ['source' => 'NDW', 'bays' => []],
        ];
    }
}
