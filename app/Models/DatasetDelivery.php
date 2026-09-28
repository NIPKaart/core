<?php

namespace App\Models;

use Database\Factories\DatasetDeliveryFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DatasetDelivery extends Model
{
    /** @use HasFactory<DatasetDeliveryFactory> */
    use HasFactory;

    protected $fillable = ['dataset_source_id', 'bucket', 'object_key', 'etag'];

    protected $casts = ['received_at' => 'immutable_datetime', 'validated_at' => 'immutable_datetime', 'late_on_receipt' => 'boolean'];
}
