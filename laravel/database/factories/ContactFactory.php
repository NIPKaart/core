<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Contact>
 */
class ContactFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => fake()->optional()->randomElement([User::factory(), null]),
            'name' => fake()->name,
            'email' => fake()->safeEmail,
            'phone' => fake()->optional()->phoneNumber,
            'contact_type' => fake()->word,
            'subject' => fake()->sentence,
            'message' => fake()->paragraph,
        ];
    }
}
