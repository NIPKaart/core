<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\UserSuspension;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UserSuspension>
 */
class UserSuspensionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'suspended_by' => User::factory(),
            'reason' => fake()->sentence(),
            'suspended_at' => now(),
        ];
    }
}
