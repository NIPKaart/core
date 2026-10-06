<?php

namespace App\Models;

use App\Enums\ParkingStatus;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Contracts\Translation\HasLocalePreference;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Passkeys\Contracts\PasskeyUser;
use Laravel\Passkeys\PasskeyAuthenticatable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements HasLocalePreference, MustVerifyEmail, PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasRoles, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    public function preferredLocale(): string
    {
        return $this->locale ?? config('app.locale');
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'locale',
        'password',
        'suspended_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'suspended_at' => 'datetime',
            'last_login_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    /**
     * Get the parking spaces for the user.
     */
    public function parkingSpaces(): HasMany
    {
        return $this->hasMany(ParkingSpace::class);
    }

    /**
     * Get the improvements the user proposed to community parking spaces.
     */
    public function parkingSpaceImprovements(): HasMany
    {
        return $this->hasMany(ParkingSpaceImprovement::class);
    }

    /**
     * Get the favorites for the user.
     */
    public function favorites(): HasMany
    {
        return $this->hasMany(Favorite::class);
    }

    /**
     * Get the parking space confirmations for the user.
     */
    public function confirmations(): HasMany
    {
        return $this->hasMany(ParkingSpaceConfirmation::class);
    }

    /**
     * Get the suspension history of the user.
     */
    public function suspensions(): HasMany
    {
        return $this->hasMany(UserSuspension::class);
    }

    /**
     * Get the suspension that is currently in effect, if any.
     */
    public function activeSuspension(): HasOne
    {
        return $this->hasOne(UserSuspension::class)->ofMany(['suspended_at' => 'max'], fn (Builder $query) => $query->whereNull('lifted_at'));
    }

    /**
     * Whether the user may add, confirm, improve or report community parking places.
     */
    public function isEligibleForCommunity(): bool
    {
        return $this->hasVerifiedEmail() && $this->suspended_at === null;
    }

    /**
     * Suspend the user and record who did it and why.
     */
    public function suspend(User $administrator, string $reason): void
    {
        DB::transaction(function () use ($administrator, $reason): void {
            $this->forceFill(['suspended_at' => now()])->save();
            $this->suspensions()->create([
                'suspended_by' => $administrator->getKey(),
                'reason' => $reason,
                'suspended_at' => $this->suspended_at,
            ]);
        });
    }

    /**
     * Lift the current suspension and record who lifted it.
     */
    public function liftSuspension(User $administrator): void
    {
        DB::transaction(function () use ($administrator): void {
            $this->activeSuspension?->update(['lifted_by' => $administrator->getKey(), 'lifted_at' => now()]);
            $this->forceFill(['suspended_at' => null])->save();
        });
    }

    /**
     * Remove personal data and unpublished community work with the account, keeping accepted parking facts anonymously.
     *
     * Favorites, confirmations, passkeys and suspensions are removed by their foreign keys.
     */
    protected static function booted(): void
    {
        static::deleting(function (User $user): void {
            $unpublishedIds = ParkingSpace::withTrashed()
                ->whereBelongsTo($user)
                ->where('status', '!=', ParkingStatus::APPROVED)
                ->pluck('id');

            Favorite::where('favoritable_type', (new ParkingSpace)->getMorphClass())
                ->whereIn('favoritable_id', $unpublishedIds)
                ->delete();
            ParkingSpace::withTrashed()->whereKey($unpublishedIds)->forceDelete();

            ParkingSpace::withTrashed()
                ->whereBelongsTo($user)
                ->update(['user_id' => null, 'ip_address' => null]);

            $user->notifications()->delete();
        });
    }
}
