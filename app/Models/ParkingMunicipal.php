<?php

namespace App\Models;

use App\Enums\ParkingOrientation;
use App\Traits\Favoritable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Laravel\Scout\Searchable;

class ParkingMunicipal extends Model
{
    /** @use HasFactory<\Database\Factories\ParkingMunicipalFactory> */
    use Favoritable, HasFactory, Searchable;

    protected $table = 'parking_municipal_spaces';

    protected $primaryKey = 'id';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'country_id',
        'province_id',
        'municipality_id',
        'number',
        'street',
        'orientation',
        'longitude',
        'latitude',
        'visibility',
    ];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'orientation' => ParkingOrientation::class,
        'updated_at' => 'datetime',
        'created_at' => 'datetime',
        'visibility' => 'boolean',
    ];

    /**
     * Get the country that owns the ParkingSpace
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * Get the province that owns the ParkingSpace
     */
    public function province(): BelongsTo
    {
        return $this->belongsTo(Province::class);
    }

    /**
     * Get the municipality that owns the ParkingMunicipal
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
        return 'parking_municipal_spaces';
    }

    /**
     * Determine if the model should be searchable.
     */
    public function shouldBeSearchable(): bool
    {
        return (bool) $this->visibility;
    }

    /**
     * Get the indexable data array for the model.
     */
    public function toSearchableArray(): array
    {
        return [
            'id' => (string) $this->id,
            'number' => (int) $this->number,
            'street' => (string) ($this->street ?? ''),
            'orientation' => $this->orientation?->value ?? (string) $this->orientation,
            'visibility' => (bool) $this->visibility,
            'country_id' => (int) $this->country_id,
            'province_id' => (int) $this->province_id,
            'municipality_id' => (int) $this->municipality_id,
            '_geo' => ['lat' => (float) $this->latitude, 'lng' => (float) $this->longitude],
            'created_at' => optional($this->created_at)->toAtomString(),
            'updated_at' => optional($this->updated_at)->toAtomString(),
        ];
    }
}
