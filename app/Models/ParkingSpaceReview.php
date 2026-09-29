<?php

namespace App\Models;

use App\Enums\ParkingStatus;
use App\Enums\RejectionReason;
use Database\Factories\ParkingSpaceReviewFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An immutable record of a moderator changing the review status of a community ParkingSpace.
 */
class ParkingSpaceReview extends Model
{
    /** @use HasFactory<ParkingSpaceReviewFactory> */
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'parking_space_id',
        'reviewed_by',
        'from_status',
        'to_status',
        'reason',
        'note',
        'reviewed_at',
    ];

    protected $casts = [
        'from_status' => ParkingStatus::class,
        'to_status' => ParkingStatus::class,
        'reason' => RejectionReason::class,
        'reviewed_at' => 'datetime',
    ];

    public function parkingSpace(): BelongsTo
    {
        return $this->belongsTo(ParkingSpace::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
