<?php

namespace App\Models;

use Database\Factories\UserSuspensionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An attributable record of an administrator suspending a user, and of lifting that suspension.
 */
class UserSuspension extends Model
{
    /** @use HasFactory<UserSuspensionFactory> */
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'suspended_by',
        'reason',
        'suspended_at',
        'lifted_by',
        'lifted_at',
    ];

    protected $casts = [
        'suspended_at' => 'datetime',
        'lifted_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function suspender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'suspended_by');
    }

    public function lifter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lifted_by');
    }
}
