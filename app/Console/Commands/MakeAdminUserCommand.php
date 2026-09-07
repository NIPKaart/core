<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Spatie\Permission\Exceptions\RoleDoesNotExist;
use Symfony\Component\Console\Formatter\OutputFormatter;

class MakeAdminUserCommand extends Command
{
    protected $signature = 'nipkaart:make-admin
        {email? : Email address of the administrator}
        {--name= : Name to use when creating a new user}
        {--password= : Password to use when creating a new user; omitted generates one}';

    protected $description = 'Create a verified administrator or promote an existing active user.';

    public function handle(): int
    {
        try {
            $role = Role::findByName(UserRole::ADMIN->value, 'web');
        } catch (RoleDoesNotExist) {
            $this->error('Administrator role is unavailable. Run php artisan db:seed --class=PermissionsTableSeeder first.');

            return self::FAILURE;
        }

        $email = $this->argument('email') ?? ($this->input->isInteractive() ? $this->ask('Email address') : null);
        $validator = Validator::make(['email' => $email], [
            'email' => ['required', 'string', 'lowercase', 'email:rfc', 'max:255'],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $existingUser = User::query()->where('email', $email)->first();

        if ($existingUser) {
            if ($existingUser->suspended_at !== null) {
                $this->error('Cannot grant administrator access to a suspended user.');

                return self::FAILURE;
            }

            if ($this->option('name') !== null || $this->option('password') !== null) {
                $this->warn('The --name and --password options only apply to new users; existing account data is unchanged.');
            }

            if ($existingUser->hasRole($role)) {
                $this->info("{$email} is already an administrator.");

                return self::SUCCESS;
            }

            $existingUser->assignRole($role);
            $this->info("Administrator access granted to {$email}.");

            return self::SUCCESS;
        }

        $name = $this->option('name') ?? ($this->input->isInteractive() ? $this->ask('Name') : null);
        $generatedPassword = $this->option('password') === null ? Str::password(24) : null;
        $password = $this->option('password') ?? $generatedPassword;
        $validator = Validator::make(['name' => $name, 'password' => $password], [
            'name' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', Password::defaults()],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $validated = $validator->validated();

        DB::transaction(function () use ($email, $validated, $role): void {
            $user = new User([
                'email' => $email,
                'name' => $validated['name'],
                'password' => $validated['password'],
            ]);
            $user->email_verified_at = now();
            $user->save();
            $user->assignRole($role);
        });

        $this->info("Verified administrator created for {$email}.");

        if ($generatedPassword !== null) {
            $this->warn('Generated password: '.OutputFormatter::escape($generatedPassword));
            $this->warn('Store this password now. It will not be shown again.');
        }

        return self::SUCCESS;
    }
}
