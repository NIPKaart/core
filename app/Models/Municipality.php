<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Scout\Searchable;

class Municipality extends Model
{
    /** @use HasFactory<\Database\Factories\MunicipalityFactory> */
    use HasFactory, Searchable;

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

    /**
     * Get the searchable index name for the model.
     */
    public function searchableAs(): string
    {
        return 'municipalities';
    }

    /**
     * Get the indexable data array for the model.
     *
     * @return array<string, mixed>
     */
    public function toSearchableArray(): array
    {
        return [
            'id' => (int) $this->id,
            'name' => (string) $this->name,
            'country_id' => (int) $this->country_id,
            'province_id' => (int) $this->province_id,
        ];
    }
}
