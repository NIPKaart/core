<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ParkingRule extends Model
{
    /** @use HasFactory<\Database\Factories\ParkingRuleFactory> */
    use HasFactory;

    protected $table = 'parking_rules';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'country_id',
        'municipality_id',
        'url',
        'nationwide',
    ];

    /**
     * Get the country that owns the parking rule.
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * Get the municipality that owns the parking rule.
     */
    public function municipality(): BelongsTo
    {
        return $this->belongsTo(Municipality::class);
    }
}
