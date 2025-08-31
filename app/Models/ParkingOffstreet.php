<?php

namespace App\Models;

use App\Traits\Favoritable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Laravel\Scout\Searchable;

class ParkingOffstreet extends Model
{
    /** @use HasFactory<\Database\Factories\ParkingOffstreetFactory> */
    use Favoritable, HasFactory, Searchable;

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
    ];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'id' => 'string',
        'prices' => 'array',
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

    /**
     * Get the searchable index name for the model.
     */
    public function searchableAs(): string
    {
        return 'parking_offstreet_spaces';
    }

    /**
     * Determine if the model should be searchable.
     */
    public function shouldBeSearchable(): bool
    {
        return (bool) $this->visibility === true;
    }

    /**
     * Get the indexable data array for the model.
     *
     * @return array<string, mixed>
     */
    public function toSearchableArray(): array
    {
        return [
            'id' => (string) $this->id,
            'name' => (string) $this->name,
            'url' => (string) ($this->url ?? ''),
            'parking_type' => (string) $this->parking_type,
            'free_space_short' => (int) $this->free_space_short,
            'free_space_long' => $this->free_space_long !== null ? (int) $this->free_space_long : null,
            'short_capacity' => (int) $this->short_capacity,
            'long_capacity' => $this->long_capacity !== null ? (int) $this->long_capacity : null,
            'visibility' => (bool) $this->visibility,
            'api_state' => $this->api_state?->value ?? (string) $this->api_state,
            'country_id' => (int) $this->country_id,
            'province_id' => (int) $this->province_id,
            'municipality_id' => (int) $this->municipality_id,
            '_geo' => ['lat' => (float) $this->latitude, 'lng' => (float) $this->longitude],
            'created_at' => optional($this->created_at)->toAtomString(),
            'updated_at' => optional($this->updated_at)->toAtomString(),
        ];
    }
}
