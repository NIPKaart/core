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
                            {--role=admin : The role to assign (default: admin)}
                            {--verify : Mark email as verified immediately}
                            {--send-verification : Send email verification notification}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a new user with role (default: admin) and optional email verification handling';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $name = $this->option('name') ?? $this->ask('Name');
        $email = $this->option('email') ?? $this->ask('Email');
        $passwordOption = $this->option('password') ?? $this->secret('Password (or leave blank to generate)');
        $roleName = $this->option('role') ?? 'admin';

        $markVerified = (bool) $this->option('verify');
        $sendVerification = (bool) $this->option('send-verification');

        if ($markVerified && $sendVerification) {
            $this->warn('Both --verify and --send-verification were provided. Proceeding with --verify and skipping email.');
            $sendVerification = false;
        }

        // Password generation logic
        $password = (empty($passwordOption) || $passwordOption === 'generate')
            ? Str::password(12)
            : $passwordOption;

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

        // Create user
        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
        ]);
        $user->assignRole($role);

        // Handle verification
        if ($markVerified) {
            // direct mark verified
            $user->forceFill(['email_verified_at' => now()])->save();
            $this->info('✅ Email marked as verified.');
        } elseif ($sendVerification) {
            if ($user instanceof MustVerifyEmail) {
                if (! $user->hasVerifiedEmail()) {
                    $user->sendEmailVerificationNotification();
                    $this->info('✉️  Verification email sent.');
                } else {
                    $this->info('ℹ️  User is already verified; not sending verification email.');
                }
            } else {
                $this->warn('User model does not implement MustVerifyEmail; cannot send verification email.');
            }
        } else {
            $this->line('ℹ️  No verification action chosen. Use --verify or --send-verification if desired.');
        }

        $this->info("User {$name} <{$email}> created and assigned role '{$roleName}'.");
        $this->newLine();
        $this->info('🔐 Login credentials:');
        $this->line("Email: {$email}");
        $this->line("Password: {$password}");

        return Command::SUCCESS;
    }
}
