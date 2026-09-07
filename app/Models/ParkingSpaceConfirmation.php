<?php

namespace App\Models;

use App\Enums\ParkingConfirmationStatus;
use Database\Factories\ParkingSpaceConfirmationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ParkingSpaceConfirmation extends Model
{
    /** @use HasFactory<ParkingSpaceConfirmationFactory> */
    use HasFactory;

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

    public function parkingSpace(): BelongsTo
    {
        return $this->belongsTo(ParkingSpace::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
