<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Country extends Model
{
    /** @use HasFactory<\Database\Factories\CountryFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'name', 'code',
    ];

    /**
     * Get the provinces for the country.
     */
    public function provinces(): HasMany
    {
        return $this->hasMany(Province::class);
    }

    /**
     * Get parking spots in the country.
     */
    public function parkingSpots(): HasMany
    {
        return $this->hasMany(ParkingSpot::class);
    }

    /**
     * Get parking offstreets in the country.
     */
    public function parkingOffstreets(): HasMany
    {
        return $this->hasMany(ParkingOffstreet::class);
    }

    /**
     * Get parking spots provided by municipalities in the country.
     */
    public function municipalParkingSpots(): HasMany
    {
        return $this->hasMany(ParkingMunicipal::class);
    }

    /**
     * Get parking rules in the country.
     */
    public function parkingRules(): HasMany
    {
        return $this->hasMany(ParkingRule::class);
    }

    /**
     * Get national parking rules in the country.
     */
    public function nationalParkingRules(): HasMany
    {
        return $this->hasMany(ParkingRule::class)->where('nationwide', true);
    }

    /**
     * Get municipal parking rules in the country.
     */
    public function municipalParkingRules(): HasMany
    {
        return $this->hasMany(ParkingRule::class)->where('nationwide', false);
    }
}
