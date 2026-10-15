<?php

namespace App\Models;

use App\Enums\ParkingStatus;
use Database\Factories\FavoriteFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Favorite extends Model
{
    /** @use HasFactory<FavoriteFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'favoritable_id',
        'favoritable_type',
    ];

    /** Only shortcuts to parking records the public map can still open. */
    public function scopeAvailable(Builder $query): void
    {
        $query->where(function (Builder $available): void {
            foreach ([ParkingSpace::class, ParkingMunicipal::class, ParkingOffstreet::class] as $type) {
                $target = $type::query()->selectRaw('id::text');
                $type === ParkingSpace::class ? $target->where('status', ParkingStatus::APPROVED) : $target->where('visibility', true);
                $available->orWhere(fn (Builder $source) => $source->where('favoritable_type', (new $type)->getMorphClass())
                    ->whereIn('favoritable_id', $target));
            }
        });
    }

    public function favoritable(): MorphTo
    {
        return $this->morphTo();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
