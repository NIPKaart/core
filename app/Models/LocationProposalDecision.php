<?php

namespace App\Models;

use App\Enums\LocationProposalDecisionReason;
use Database\Factories\LocationProposalDecisionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LocationProposalDecision extends Model
{
    /** @use HasFactory<LocationProposalDecisionFactory> */
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'location_proposal_id', 'moderator_id', 'decided_at', 'outcome', 'reason', 'note',
        'existing_parking_space_id', 'evidence',
    ];

    protected $casts = [
        'decided_at' => 'datetime',
        'reason' => LocationProposalDecisionReason::class,
        'evidence' => 'array',
    ];

    public function moderator(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
