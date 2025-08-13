<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

class CreateUserCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user:create
                            {--name= : The name of the user}
                            {--email= : The email of the user}
                            {--password= : The password of the user, or "generate" for random}
                            {--role=admin : The role to assign (default: admin)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a new user with optional role (default: admin)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $name = $this->option('name') ?? $this->ask('Name');
        $email = $this->option('email') ?? $this->ask('Email');
        $passwordOption = $this->option('password') ?? $this->secret('Password (or leave blank to generate)');
        $roleName = $this->option('role') ?? 'admin';

        // Password generation logic
        if (empty($passwordOption) || $passwordOption === 'generate') {
            $password = Str::password(12);
        } else {
            $password = $passwordOption;
        }

        // Validate user account existence
        if (User::where('email', $email)->exists()) {
            $this->error("A user with email {$email} already exists.");

            return Command::FAILURE;
        }

        // Validate role existence
        try {
            $role = Role::findByName($roleName);
        } catch (\Spatie\Permission\Exceptions\RoleDoesNotExist $e) {
            $this->error("The role '{$roleName}' does not exist.");

            return Command::FAILURE;
        }

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
        ]);
        $user->assignRole($role);

        $this->info("User {$name} <{$email}> created and assigned role '{$roleName}'.");
        $this->newLine();
        $this->info('✅ Login credentials:');
        $this->line("Email: {$email}");
        $this->line("Password: {$password}");

        return Command::SUCCESS;
    }
}
