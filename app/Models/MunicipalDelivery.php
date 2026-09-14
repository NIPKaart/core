<?php

namespace App\Models;

use Database\Factories\MunicipalDeliveryFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MunicipalDelivery extends Model
{
    /** @use HasFactory<MunicipalDeliveryFactory> */
    use HasFactory;

    protected $fillable = ['dataset_source_id', 'bucket', 'object_key', 'etag'];

    protected $casts = ['received_at' => 'immutable_datetime', 'validated_at' => 'immutable_datetime', 'late_on_receipt' => 'boolean'];
}
