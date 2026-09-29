<?php

namespace App\Models;

use App\Enums\ParkingConfirmationStatus;
use Database\Factories\ParkingSpaceConfirmationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A dated confirmation that a community or municipal parking place exists; exactly one target is set.
 */
class ParkingSpaceConfirmation extends Model
{
    /** @use HasFactory<ParkingSpaceConfirmationFactory> */
    use HasFactory;

    protected $fillable = [
        'parking_space_id',
        'parking_municipal_id',
        'user_id',
        'confirmed_at',
        'status',
        'comment',
    ];

    protected $casts = [
        'status' => ParkingConfirmationStatus::class,
        'confirmed_at' => 'datetime',
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
}
