<?php

namespace App\Models;

use App\Enums\RemovalAction;
use App\Enums\RemovalReason;
use Database\Factories\ParkingPlaceRemovalFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An attributable moderator decision to delete a community place or hide a municipal one after reports.
 *
 * It outlives the deleted place, so it keeps only the place's source, identity and label.
 */
class ParkingPlaceRemoval extends Model
{
    /** @use HasFactory<ParkingPlaceRemovalFactory> */
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'source',
        'place_id',
        'place_label',
        'action',
        'reason',
        'note',
        'open_reports',
        'removed_by',
        'removed_at',
    ];

    protected $casts = [
        'action' => RemovalAction::class,
        'reason' => RemovalReason::class,
        'open_reports' => 'integer',
        'removed_at' => 'datetime',
    ];

    public function remover(): BelongsTo
    {
        return $this->belongsTo(User::class, 'removed_by');
    }
}
