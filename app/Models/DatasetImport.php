<?php

namespace App\Models;

use Database\Factories\DatasetImportFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class DatasetImport extends Model
{
    /** @use HasFactory<DatasetImportFactory> */
    use HasFactory;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['dataset_source_id', 'delivery_id', 'fingerprint', 'retrieved_at', 'dataset_config', 'records', 'submitted_by'];

    protected $casts = ['dataset_config' => 'array', 'records' => 'array', 'before_values' => 'array', 'retrieved_at' => 'immutable_datetime', 'reviewed_at' => 'immutable_datetime'];

    protected $hidden = ['records', 'before_values', 'dataset_config'];

    public function isSuperseded(): bool
    {
        $publishedAt = $this->datasetSource->last_published_retrieved_at;

        return $this->state === 'pending' && $publishedAt !== null && $this->retrieved_at->lessThanOrEqualTo($publishedAt);
    }

    public function datasetSource(): BelongsTo
    {
        return $this->belongsTo(DatasetSource::class);
    }

    public function delivery(): HasOne
    {
        return $this->hasOne(DatasetDelivery::class)->ofMany('id', 'min');
    }
}
