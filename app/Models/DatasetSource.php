<?php

namespace App\Models;

use Database\Factories\DatasetSourceFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Arr;

class DatasetSource extends Model
{
    /** @use HasFactory<DatasetSourceFactory> */
    use HasFactory;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['code', 'name', 'selection', 'target_type', 'source_url', 'attribution', 'terms_url', 'municipality_id', 'bounds', 'publication_enabled'];

    protected $casts = ['terms_review' => 'array', 'bounds' => 'array', 'publication_enabled' => 'boolean', 'last_published_retrieved_at' => 'immutable_datetime'];

    public function municipality(): BelongsTo
    {
        return $this->belongsTo(Municipality::class);
    }

    public function latestImport(): HasOne
    {
        return $this->hasOne(MunicipalImport::class)->ofMany(['retrieved_at' => 'max', 'id' => 'max']);
    }

    public function latestDelivery(): HasOne
    {
        return $this->hasOne(MunicipalDelivery::class)->latestOfMany();
    }

    public function municipalSpaces(): HasMany
    {
        return $this->hasMany(ParkingMunicipal::class);
    }

    /** @return array<string, mixed> */
    public function configuration(): array
    {
        return [...Arr::except($this->only($this->fillable), ['publication_enabled']), 'country_id' => $this->municipality->country_id, 'province_id' => $this->municipality->province_id];
    }
}
