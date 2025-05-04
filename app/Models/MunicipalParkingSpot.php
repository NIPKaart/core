<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MunicipalParkingSpot extends Model
{
    /** @use HasFactory<\Database\Factories\MunicipalParkingSpotFactory> */
    use HasFactory;

    protected $table = 'municipal_parking_spots';

    protected $primaryKey = 'id';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * The attributes that should be cast to native types.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'orientation' => ParkingOrientation::class,
        'updated_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    /**
     * Get the country that owns the ParkingSpot
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * Get the province that owns the ParkingSpot
     */
    public function province(): BelongsTo
    {
        return $this->belongsTo(Province::class);
    }
}
