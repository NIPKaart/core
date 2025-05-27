<?php

namespace App\Traits;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

trait Favoritable
{
    public function favoritedByUsers(): MorphToMany
    {
        return $this->morphToMany(
            User::class,
            'favoritable',
            'favorites'
        );
    }

    public function isFavoritedBy(User $user): bool
    {
        return $this->favoritedByUsers()->where('user_id', $user->id)->exists();
    }
}
