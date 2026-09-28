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

    protected $fillable = ['code', 'name', 'selection', 'target_type', 'publisher', 'source_url', 'licence', 'attribution', 'terms_url', 'municipality_id', 'bounds', 'expected_interval_hours', 'description'];

    protected $casts = [
        'bounds' => 'array', 'description' => 'array', 'pending_description' => 'array',
        'expected_interval_hours' => 'integer', 'reviewed_at' => 'immutable_datetime', 'last_published_retrieved_at' => 'immutable_datetime',
    ];

    /** Deliveries of a source flow into review only after an administrator approved the source (ADR 0013). */
    public function isApproved(): bool
    {
        return $this->approval_state === 'approved';
    }

    /**
     * Source fields derived from a validated `source` block.
     *
     * @param  array<string, mixed>  $description
     * @return array<string, mixed>
     */
    public static function attributesFromDescription(array $description): array
    {
        return [
            'name' => $description['name'], 'publisher' => $description['publisher'],
            'source_url' => $description['source_url'], 'licence' => $description['licence'],
            'terms_url' => $description['terms_url'], 'attribution' => $description['attribution'],
            'bounds' => $description['bounds'], 'expected_interval_hours' => $description['expected_interval_hours'],
            'description' => $description,
        ];
    }

    public function municipality(): BelongsTo
    {
        return $this->belongsTo(Municipality::class);
    }

    public function latestImport(): HasOne
    {
        return $this->hasOne(DatasetImport::class)->ofMany(['retrieved_at' => 'max', 'id' => 'max']);
    }

    public function latestDelivery(): HasOne
    {
        return $this->hasOne(DatasetDelivery::class)->latestOfMany();
    }

    public function municipalSpaces(): HasMany
    {
        return $this->hasMany(ParkingMunicipal::class);
    }

    public function offstreetSpaces(): HasMany
    {
        return $this->hasMany(ParkingOffstreet::class);
    }

    /**
     * The approved source identity an import was staged against. The delivery interval may change without
     * invalidating staged imports.
     *
     * @return array<string, mixed>
     */
    public function configuration(): array
    {
        return [...Arr::except($this->only($this->fillable), ['expected_interval_hours', 'description']), 'country_id' => $this->municipality?->country_id, 'province_id' => $this->municipality?->province_id];
    }
}
