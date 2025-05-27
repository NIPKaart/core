<?php

namespace App\Models;

use App\Traits\Favoritable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

class ParkingMunicipal extends Model
{
    /** @use HasFactory<\Database\Factories\ParkingMunicipalFactory> */
    use Favoritable, HasFactory;

    protected $table = 'parking_municipal';

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
