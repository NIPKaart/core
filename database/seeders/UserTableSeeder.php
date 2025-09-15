<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $users = [
            ['name' => 'Admin', 'email' => 'admin@example.com', 'role' => UserRole::ADMIN],
            ['name' => 'Moderator', 'email' => 'moderator@example.com', 'role' => UserRole::MODERATOR],
            ['name' => 'User', 'email' => 'user@example.com', 'role' => UserRole::USER],
        ];

        foreach ($users as $data) {
            $user = User::firstOrCreate([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make('password'),
                'locale' => 'en',
            ]);

            $user->assignRole($data['role']->value);
        }
    }
}
