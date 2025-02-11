<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Province extends Model
{
    /** @use HasFactory<\Database\Factories\ProvinceFactory> */
    use HasFactory;

    protected $fillable = [
        'country_id',
        'name',
        'geocode',
    ];

    /**
     * Get the country that owns the province.
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }
}
