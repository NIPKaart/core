<?php

namespace App\Models;

use App\Enums\ReportReason;
use App\Enums\ReportResolution;
use Database\Factories\ParkingPlaceReportFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A signed-in user's report that a community or municipal parking place no longer exists; exactly one target is set.
 *
 * A report is a moderation signal, never a vote: it does not change what the map shows.
 */
class ParkingPlaceReport extends Model
{
    /** @use HasFactory<ParkingPlaceReportFactory> */
    use HasFactory;

    protected $fillable = [
        'parking_space_id',
        'parking_municipal_id',
        'user_id',
        'reason',
        'note',
    ];

    protected $casts = [
        'reason' => ReportReason::class,
        'resolution' => ReportResolution::class,
        'resolved_at' => 'datetime',
    ];

    public function parkingSpace(): BelongsTo
    {
        return $this->belongsTo(ParkingSpace::class);
    }

    public function parkingMunicipal(): BelongsTo
    {
        return $this->belongsTo(ParkingMunicipal::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    /**
     * Reports a moderator has not closed yet.
     */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereNull('resolved_at');
    }
}
