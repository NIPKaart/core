<?php

namespace App\Models;

use App\Enums\ParkingOrientation;
use App\Traits\Favoritable;
use App\Traits\HasParkingLocation;
use Database\Factories\ParkingMunicipalFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ParkingMunicipal extends Model
{
    /** @use HasFactory<ParkingMunicipalFactory> */
    use Favoritable, HasFactory, HasParkingLocation;

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
        'latitude' => 'float',
        'longitude' => 'float',
        'number' => 'integer',
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
}
