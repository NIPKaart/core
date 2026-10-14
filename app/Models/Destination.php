<?php

namespace App\Models;

use Database\Factories\DestinationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Destination extends Model
{
    /** @use HasFactory<DestinationFactory> */
    use HasFactory;

    protected $fillable = ['label', 'key', 'name', 'sub', 'type', 'latitude', 'longitude', 'bounds'];

    protected function casts(): array
    {
        return ['latitude' => 'float', 'longitude' => 'float', 'bounds' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
