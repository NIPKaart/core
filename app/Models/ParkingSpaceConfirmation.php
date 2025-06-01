<?php

namespace App\Models;

use App\Enums\ParkingConfirmationStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ParkingSpaceConfirmation extends Model
{
    protected $fillable = [
        'parking_space_id',
        'user_id',
        'confirmed_at',
        'status',
        'comment',
    ];

    protected $casts = [
        'status' => ParkingConfirmationStatus::class,
        'confirmed_at' => 'datetime',
    ];

    protected $dates = [
        'confirmed_at',
        'created_at',
        'updated_at',
    ];

    public function parkingSpace(): BelongsTo
    {
        return $this->belongsTo(ParkingSpace::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
