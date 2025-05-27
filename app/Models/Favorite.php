<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

class Favorite extends Model
{
    protected $fillable = [
        'user_id',
        'favoritable_id',
        'favoritable_type',
    ];

    public function favoritable(): MorphTo
    {
        return $this->morphTo();
    }

    public function favoritedByUsers(): MorphToMany
    {
        return $this->morphToMany(User::class, 'favoritable', 'favorites');
    }
}
