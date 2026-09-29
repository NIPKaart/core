<?php

namespace App\Traits;

use App\Enums\ParkingConfirmationStatus;
use App\Models\ParkingSpaceConfirmation;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A parking place whose existence signed-in users can confirm, whatever its source.
 */
trait Confirmable
{
    public function confirmations(): HasMany
    {
        return $this->hasMany(ParkingSpaceConfirmation::class);
    }

    public function isConfirmedTodayBy(User $user): bool
    {
        return $this->confirmations()
            ->whereBelongsTo($user)
            ->whereDate('confirmed_at', now()->toDateString())
            ->exists();
    }

    /**
     * Public evidence that the place exists; legacy disputes are not existence confirmations.
     *
     * @return array{confirmed_today: bool, confirmations_count: array{confirmed: int}, last_confirmed_at: string|null}
     */
    public function publicConfirmations(?User $user): array
    {
        $confirmed = $this->confirmations()->where('status', ParkingConfirmationStatus::CONFIRMED);

        return [
            'confirmed_today' => $user ? $this->isConfirmedTodayBy($user) : false,
            'confirmations_count' => [
                'confirmed' => (clone $confirmed)->count(),
            ],
            'last_confirmed_at' => $confirmed->max('confirmed_at'),
        ];
    }
}
