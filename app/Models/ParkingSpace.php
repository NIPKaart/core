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
use Laravel\Scout\Searchable;

class ParkingSpace extends Model
{
    /** @use HasFactory<\Database\Factories\ParkingSpaceFactory> */
    use Favoritable, HasFactory, Searchable, SoftDeletes;

    protected $table = 'parking_spaces';

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
        'municipality_id',
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
        'latitude' => 'float',
        'longitude' => 'float',
        'updated_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    /**
     * Get the user that owns the ParkingSpace
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

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
     * Get the confirmations for the ParkingSpace
     */
    public function confirmations(): HasMany
    {
        return $this->hasMany(ParkingSpaceConfirmation::class);
    }

    /**
     * Get the municipality that owns the ParkingSpace
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
        return 'parking_spaces';
    }

    /**
     * Determine if the model should be searchable.
     */
    public function shouldBeSearchable(): bool
    {
        return (string) $this->status === ParkingStatus::APPROVED->value;
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
            'street' => (string) $this->street,
            'city' => (string) $this->city,
            'postcode' => (string) $this->postcode,
            'suburb' => (string) ($this->suburb ?? ''),
            'neighbourhood' => (string) ($this->neighbourhood ?? ''),
            'amenity' => (string) ($this->amenity ?? ''),
            'description' => (string) ($this->description ?? ''),
            'orientation' => $this->orientation?->value ?? (string) $this->orientation,
            'status' => $this->status?->value ?? (string) $this->status,
            'country_id' => (int) $this->country_id,
            'province_id' => (int) $this->province_id,
            'municipality_id' => (int) $this->municipality_id,
            '_geo' => ['lat' => (float) $this->latitude, 'lng' => (float) $this->longitude],
            'created_at' => optional($this->created_at)->toAtomString(),
            'updated_at' => optional($this->updated_at)->toAtomString(),
        ];
    }
}
