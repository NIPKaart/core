<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Province extends Model
{
    /** @use HasFactory<\Database\Factories\ProvinceFactory> */
    use HasFactory;

    protected $fillable = [
        'country_id',
        'name',
        'geocode',
    ];

    /**
     * Get the country that owns the province.
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * Get parking spots in the province.
     */
    public function parkingSpots(): HasMany
    {
        return $this->hasMany(UserParkingSpot::class);
    }

    /**
     * Get parking offstreets in the province.
     */
    public function parkingOffstreets(): HasMany
    {
        return $this->hasMany(ParkingOffstreet::class);
    }

    /**
     * Get parking spots provided by municipalities in the province.
     */
    public function municipalParkingSpots(): HasMany
    {
        return $this->hasMany(MunicipalParkingSpot::class);
    }
}
