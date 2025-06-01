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
     * Get parking spaces in the province.
     */
    public function parkingSpaces(): HasMany
    {
        return $this->hasMany(ParkingSpace::class);
    }

    /**
     * Get parking offstreets in the province.
     */
    public function parkingOffstreets(): HasMany
    {
        return $this->hasMany(ParkingOffstreet::class);
    }

    /**
     * Get parking spaces provided by municipalities in the province.
     */
    public function municipalParkingSpaces(): HasMany
    {
        return $this->hasMany(ParkingMunicipal::class);
    }
}
