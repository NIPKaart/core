<?php

namespace App\Models;

use App\Enums\ParkingConfirmationStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ParkingSpotConfirmation extends Model
{
    protected $fillable = [
        'parking_spot_id',
        'user_id',
        'confirmed_at',
        'status',
        'comment',
    ];

    protected $casts = [
        'status' => ParkingConfirmationStatus::class,
        'confirmed_at' => 'datetime',
    ];

    public function parkingSpot(): BelongsTo
    {
        return $this->belongsTo(ParkingSpot::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
