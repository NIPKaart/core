<?php

namespace App\Models;

use App\Enums\ApiState;
use App\Traits\Favoritable;
use App\Traits\HasParkingLocation;
use Database\Factories\ParkingOffstreetFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ParkingOffstreet extends Model
{
    /** @use HasFactory<ParkingOffstreetFactory> */
    use Favoritable, HasFactory, HasParkingLocation;

    protected $table = 'parking_offstreet_spaces';

    protected $primaryKey = 'id';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * The attributes that are mass assignable.
     */
    /** Source provenance stays out of public JSON; detail endpoints choose what to expose. */
    protected $hidden = ['source_record', 'last_imported_values', 'published_import_id', 'publishedImport'];

    protected $fillable = [
        'country_id',
        'province_id',
        'municipality_id',
        'visibility',
    ];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'id' => 'string',
        'prices' => 'array',
        'api_state' => ApiState::class,
        'visibility' => 'boolean',
        'latitude' => 'float',
        'longitude' => 'float',
        'free_space' => 'integer',
        'observed_at' => 'immutable_datetime',
        'observation_fetched_at' => 'immutable_datetime',
        'capacity' => 'integer',
        'source_record' => 'array',
        'last_imported_values' => 'array',
        'last_checked_at' => 'immutable_datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Whether the latest measurement may be shown as current (#1221). `current` needs a recent measurement with feed state
     * `ok` and either a count or an open/full status; `closed` is its own state, because a closed site also reports zero free.
     */
    public function availability(): string
    {
        if ($this->observed_at === null) {
            return $this->api_state === ApiState::ERROR ? 'unavailable' : 'unknown';
        }
        if ($this->api_state !== ApiState::OK || $this->occupancy_status === 'malfunction') {
            return 'unavailable';
        }
        if ($this->observed_at->lt(now()->subMinutes(config('dataset-deliveries.observation_stale_after_minutes')))) {
            return 'stale';
        }
        if ($this->occupancy_status === 'closed') {
            return 'closed';
        }

        return $this->free_space === null && ! in_array($this->occupancy_status, ['open', 'full'], true) ? 'unavailable' : 'current';
    }

    public function datasetSource(): BelongsTo
    {
        return $this->belongsTo(DatasetSource::class);
    }

    public function publishedImport(): BelongsTo
    {
        return $this->belongsTo(DatasetImport::class, 'published_import_id');
    }

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
}
