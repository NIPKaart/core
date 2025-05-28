<?php

namespace App\Models;

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Traits\Favoritable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ParkingSpot extends Model
{
    /** @use HasFactory<\Database\Factories\ParkingSpotFactory> */
    use Favoritable, HasFactory, SoftDeletes;

    protected $table = 'parking_spots';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'id',
        'user_id',
        'ip_address',
        'latitude',
        'longitude',
        'orientation',
        'parking_time',
        'parking_disc',
        'window_times',
        'description',
        'status',
        'country_id',
        'province_id',
        'municipality',
        'city',
        'suburb',
        'neighbourhood',
        'postcode',
        'street',
        'amenity',
    ];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'status' => ParkingStatus::class,
        'orientation' => ParkingOrientation::class,
        'updated_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    /**
     * Get the user that owns the ParkingSpot
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the country that owns the ParkingSpot
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * Get the province that owns the ParkingSpot
     */
    public function province(): BelongsTo
    {
        return $this->belongsTo(Province::class);
    }

    /**
     * Get the confirmations for the ParkingSpot
     */
    public function confirmations(): HasMany
    {
        return $this->hasMany(ParkingSpotConfirmation::class);
    }

    // /**
    //  * Scope a query to only include approved parking spots.
    //  *
    //  * @param  \Illuminate\Database\Eloquent\Builder  $query
    //  * @return \Illuminate\Database\Eloquent\Builder
    //  */
    // public function scopeApproved($query): mixed
    // {
    //     return $query->where('status', ParkingStatus::APPROVED);
    // }
}
