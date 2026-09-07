<?php

namespace App\Models;

use Database\Factories\MunicipalityFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Municipality extends Model
{
    /** @use HasFactory<MunicipalityFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'country_id',
        'province_id',
    ];

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    public function province(): BelongsTo
    {
        return $this->belongsTo(Province::class);
    }

    public function parkingOffstreets(): HasMany
    {
        return $this->hasMany(ParkingOffstreet::class);
    }

    public function parkingRules(): HasMany
    {
        return $this->hasMany(ParkingRule::class);
    }

    /**
     * Get the parking spaces for the municipality.
     */
    public function parkingSpaces(): HasMany
    {
        return $this->hasMany(ParkingSpace::class);
    }

    /**
     * Get the municipal parking spaces for the municipality.
     */
    public function parkingMunicipal(): HasMany
    {
        return $this->hasMany(ParkingMunicipal::class);
    }
}
