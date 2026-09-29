<?php

namespace App\Models;

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Enums\RejectionReason;
use App\Enums\UnderSign;
use App\Traits\Favoritable;
use App\Traits\HasParkingLocation;
use Database\Factories\ParkingSpaceFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class ParkingSpace extends Model
{
    /** @use HasFactory<ParkingSpaceFactory> */
    use Favoritable, HasFactory, HasParkingLocation, SoftDeletes;

    protected $table = 'parking_spaces';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'id',
        'user_id',
        'ip_address',
        'latitude',
        'longitude',
        'orientation',
        'under_sign',
        'under_sign_text',
        'parking_time',
        'parking_disc',
        'restriction_days',
        'restriction_starts_at',
        'restriction_ends_at',
        'description',
        'status',
        'country_id',
        'province_id',
        'municipality_id',
        'city',
        'suburb',
        'neighbourhood',
        'postcode',
        'street',
        'amenity',
    ];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'status' => ParkingStatus::class,
        'orientation' => ParkingOrientation::class,
        'under_sign' => UnderSign::class,
        'parking_disc' => 'boolean',
        'restriction_days' => 'array',
        'parking_time' => 'integer',
        'latitude' => 'float',
        'longitude' => 'float',
        'updated_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    /**
     * Get the user that owns the ParkingSpace
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the review decisions made about the ParkingSpace
     */
    public function reviews(): HasMany
    {
        return $this->hasMany(ParkingSpaceReview::class);
    }

    /**
     * Get the most recent review decision about the ParkingSpace
     */
    public function latestReview(): HasOne
    {
        return $this->hasOne(ParkingSpaceReview::class)->latestOfMany('reviewed_at');
    }

    /**
     * Days of the week a structured time restriction can apply to, in ISO order.
     */
    public const array RESTRICTION_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    /**
     * Save pending changes and, when the status changed, record the change as a review by the given moderator.
     *
     * A rejection carries the moderator's reason and optional note.
     */
    public function saveReviewedBy(User $reviewer, ?RejectionReason $reason = null, ?string $note = null): void
    {
        DB::transaction(function () use ($reviewer, $reason, $note): void {
            $statusChanged = $this->isDirty('status');
            $previousStatus = $this->getOriginal('status');

            $this->save();

            if ($statusChanged) {
                $this->reviews()->create([
                    'reviewed_by' => $reviewer->getKey(),
                    'from_status' => $previousStatus,
                    'to_status' => $this->status,
                    'reason' => $this->status === ParkingStatus::REJECTED ? $reason : null,
                    'note' => $this->status === ParkingStatus::REJECTED ? $note : null,
                    'reviewed_at' => now(),
                ]);
            }
        });
    }

    /**
     * Get the country that owns the ParkingSpace
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * Get the province that owns the ParkingSpace
     */
    public function province(): BelongsTo
    {
        return $this->belongsTo(Province::class);
    }

    /**
     * Get the confirmations for the ParkingSpace
     */
    public function confirmations(): HasMany
    {
        return $this->hasMany(ParkingSpaceConfirmation::class);
    }

    /**
     * Get the municipality that owns the ParkingSpace
     */
    public function municipality(): BelongsTo
    {
        return $this->belongsTo(Municipality::class);
    }
}
