<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword;
use App\Http\Responses\PasswordResetLinkResponse;
use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Inertia\Inertia;
use Laravel\Fortify\Contracts\FailedPasswordResetLinkRequestResponse;
use Laravel\Fortify\Contracts\SuccessfulPasswordResetLinkRequestResponse;
use Laravel\Fortify\Fortify;
use Laravel\Passkeys\Actions\StorePasskey;
use Laravel\Passkeys\Actions\VerifyPasskey;
use Laravel\Passkeys\Passkeys;

class FortifyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(VerifyPasskey::class, \App\Actions\Passkeys\VerifyPasskey::class);
        $this->app->bind(StorePasskey::class, \App\Actions\Passkeys\StorePasskey::class);
        $this->app->singleton(SuccessfulPasswordResetLinkRequestResponse::class, PasswordResetLinkResponse::class);
        $this->app->singleton(FailedPasswordResetLinkRequestResponse::class, PasswordResetLinkResponse::class);
    }

    public function boot(): void
    {
        Fortify::createUsersUsing(CreateNewUser::class);
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);
        Fortify::authenticateUsing(function (Request $request) {
            $provider = Auth::guard('web')->getProvider();
            $user = $provider->retrieveByCredentials($request->only('email', 'password'));
            if (! $user || $user->suspended_at || ! $provider->validateCredentials($user, ['password' => $request->password])) {
                return null;
            }
            $provider->rehashPasswordIfRequired($user, ['password' => $request->password]);

            return $user;
        });
        Passkeys::authorizeLoginUsing(fn (Request $request, User $user): bool => ! $user->suspended_at);

        Fortify::loginView(fn (Request $request) => Inertia::render('auth/login', [
            'canResetPassword' => true, 'status' => $request->session()->get('status'),
        ]));
        Fortify::registerView(fn () => Inertia::render('auth/register'));
        Fortify::requestPasswordResetLinkView(fn (Request $request) => Inertia::render('auth/forgot-password', [
            'status' => $request->session()->get('status'),
        ]));
        Fortify::resetPasswordView(fn (Request $request) => Inertia::render('auth/reset-password', [
            'email' => $request->email, 'token' => $request->route('token'),
        ]));
        Fortify::verifyEmailView(fn (Request $request) => Inertia::render('auth/verify-email', [
            'status' => $request->session()->get('status'),
        ]));
        Fortify::confirmPasswordView(fn () => Inertia::render('auth/confirm-password'));
        Fortify::twoFactorChallengeView(fn () => Inertia::render('auth/two-factor-challenge'));

        RateLimiter::for('two-factor', fn (Request $request) => Limit::perMinute(5)->by((string) $request->session()->get('login.id', $request->ip())));
        RateLimiter::for('passkeys', fn (Request $request) => Limit::perMinute(10)->by((string) ($request->user()?->id ?? $request->ip())));

        // Apply application boundaries to the package routes, including cached routes.
        $this->app->booted(function () {
            foreach (Route::getRoutes() as $route) {
                $name = $route->getName();
                if (in_array($name, ['password.confirm.store', 'two-factor.confirm', 'two-factor.enable', 'two-factor.disable', 'two-factor.regenerate-recovery-codes'], true)) {
                    $route->middleware('throttle:6,1,security');
                }
                if ((str_starts_with($name ?? '', 'two-factor.') && ! str_starts_with($name, 'two-factor.login')) || in_array($name, ['passkey.registration-options', 'passkey.store', 'passkey.destroy'], true)) {
                    $route->middleware('verified');
                }
            }
        });
    }
}
