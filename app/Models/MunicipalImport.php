<?php

namespace App\Models;

use Database\Factories\MunicipalImportFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MunicipalImport extends Model
{
    /** @use HasFactory<MunicipalImportFactory> */
    use HasFactory;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['dataset_source_id', 'delivery_id', 'fingerprint', 'retrieved_at', 'dataset_config', 'records', 'submitted_by'];

    protected $casts = ['dataset_config' => 'array', 'records' => 'array', 'before_values' => 'array', 'retrieved_at' => 'immutable_datetime', 'reviewed_at' => 'immutable_datetime'];

    protected $hidden = ['records', 'before_values', 'dataset_config'];

    public function datasetSource(): BelongsTo
    {
        return $this->belongsTo(DatasetSource::class);
    }
}
