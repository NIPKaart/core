<?php

namespace App\Models;

use Database\Factories\DatasetImportFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Query\Builder as QueryBuilder;

class DatasetImport extends Model
{
    /** @use HasFactory<DatasetImportFactory> */
    use HasFactory;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['dataset_source_id', 'delivery_id', 'fingerprint', 'retrieved_at', 'dataset_config', 'records', 'submitted_by'];

    protected $casts = ['dataset_config' => 'array', 'records' => 'array', 'before_values' => 'array', 'identity_decisions' => 'array', 'identity_resolution' => 'array', 'publication_checks' => 'array', 'retrieved_at' => 'immutable_datetime', 'reviewed_at' => 'immutable_datetime'];

    protected $hidden = ['records', 'before_values', 'dataset_config', 'identity_decisions', 'identity_resolution'];

    public function isSuperseded(): bool
    {
        return $this->state === 'pending' && static::whereKey($this->id)->superseded()->exists();
    }

    public function scopeSuperseded(Builder $query, bool $superseded = true): Builder
    {
        $replaced = fn (Builder $imports): Builder => $imports
            ->whereHas('datasetSource', fn (Builder $source): Builder => $source
                ->whereNotNull('last_published_retrieved_at')
                ->whereColumn('dataset_imports.retrieved_at', '<=', 'dataset_sources.last_published_retrieved_at'))
            ->orWhereExists(fn (QueryBuilder $newer): QueryBuilder => $newer->selectRaw('1')->from('dataset_imports as newer')
                ->whereColumn('newer.dataset_source_id', 'dataset_imports.dataset_source_id')
                ->where(fn (QueryBuilder $order): QueryBuilder => $order->whereColumn('newer.retrieved_at', '>', 'dataset_imports.retrieved_at')
                    ->orWhere(fn (QueryBuilder $tie): QueryBuilder => $tie->whereColumn('newer.retrieved_at', 'dataset_imports.retrieved_at')
                        ->whereColumn('newer.id', '>', 'dataset_imports.id'))));

        return $query->where('state', 'pending')->when($superseded,
            fn (Builder $query): Builder => $query->where($replaced),
            fn (Builder $query): Builder => $query->whereNot($replaced));
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
