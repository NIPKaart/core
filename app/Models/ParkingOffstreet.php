<?php

namespace App\Models;

use App\Enums\ApiState;
use App\Traits\Favoritable;
use App\Traits\HasParkingLocation;
use Database\Factories\ParkingOffstreetFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ParkingOffstreet extends Model
{
    /** @use HasFactory<ParkingOffstreetFactory> */
    use Favoritable, HasFactory, HasParkingLocation;

    protected $table = 'parking_offstreet_spaces';

    protected $primaryKey = 'id';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'country_id',
        'province_id',
        'municipality_id',
        'visibility',
    ];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'id' => 'string',
        'prices' => 'array',
        'api_state' => ApiState::class,
        'visibility' => 'boolean',
        'latitude' => 'float',
        'longitude' => 'float',
        'free_space_short' => 'integer',
        'free_space_long' => 'integer',
        'short_capacity' => 'integer',
        'long_capacity' => 'integer',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the country that owns the parking offstreet.
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * Get the province that owns the parking offstreet.
     */
    public function province(): BelongsTo
    {
        return $this->belongsTo(Province::class);
    }

    /**
     * Get the municipality that owns the parking offstreet.
     */
    public function municipality(): BelongsTo
    {
        return $this->belongsTo(Municipality::class);
    }
}
