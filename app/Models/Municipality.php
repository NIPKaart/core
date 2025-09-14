<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Municipality extends Model
{
    /** @use HasFactory<\Database\Factories\MunicipalityFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'country_id',
        'province_id',
    ];

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
