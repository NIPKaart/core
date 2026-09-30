<?php

namespace App\Models;

use App\Enums\ImprovementRejectionReason;
use App\Enums\ParkingStatus;
use Database\Factories\ParkingSpaceImprovementFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A signed-in user's proposed improvement to a published community ParkingSpace.
 *
 * The public space stays unchanged while it is pending. `submitted` holds the changes the user proposed; after
 * approval `approved` holds the changes the moderator applied, possibly corrected, and `previous` the values they replaced.
 */
class ParkingSpaceImprovement extends Model
{
    /** @use HasFactory<ParkingSpaceImprovementFactory> */
    use HasFactory;

    protected $fillable = [
        'parking_space_id',
        'user_id',
        'status',
        'submitted',
        'approved',
        'previous',
        'reason',
        'note',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'status' => ParkingStatus::class,
        'submitted' => 'array',
        'approved' => 'array',
        'previous' => 'array',
        'reason' => ImprovementRejectionReason::class,
        'reviewed_at' => 'datetime',
    ];

    public function parkingSpace(): BelongsTo
    {
        return $this->belongsTo(ParkingSpace::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Improvements awaiting a moderator's decision.
     */
    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', ParkingStatus::PENDING);
    }
}
