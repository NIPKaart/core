<?php

namespace App\Providers;

use App\Contracts\DestinationGeocoder;
use App\Contracts\ReverseGeocoder;
use App\Enums\UserRole;
use App\Models\ParkingSpace;
use App\Models\User;
use App\Observers\ParkingSpaceObserver;
use App\Services\DatasetDeliveryStorage;
use App\Services\GeocoderChain;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Contracts\Auth\Access\Gate;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate as GateFacade;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Opcodes\LogViewer\Facades\LogViewer;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(GeocoderChain::class, fn ($app): GeocoderChain => GeocoderChain::fromConfig($app));
        $this->app->bind(DestinationGeocoder::class, GeocoderChain::class);
        $this->app->bind(ReverseGeocoder::class, GeocoderChain::class);
        $this->app->bind(DatasetDeliveryStorage::class, fn () => new DatasetDeliveryStorage(Storage::disk('dataset-deliveries')->getClient()));

        // Registered before boot so it precedes Spatie's permission check, which would otherwise grant a suspended user's role permissions.
        $this->app->afterResolving(Gate::class, function (Gate $gate): void {
            $gate->before(fn (User $user): ?bool => $user->suspended_at ? false : null);
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('parking-discovery', function (Request $request): array {
            $key = $request->user() ? 'user:'.$request->user()->getAuthIdentifier() : 'ip:'.$request->ip();

            return [
                Limit::perMinute(1000)->by('minute:'.$key),
                Limit::perHour(10000)->by('hour:'.$key),
            ];
        });

        Model::automaticallyEagerLoadRelationships();

        Model::shouldBeStrict(! $this->app->isProduction());
        DB::prohibitDestructiveCommands($this->app->isProduction());

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)->mixedCase()->letters()->numbers()->symbols()->uncompromised()
            : null);

        ParkingSpace::observe(ParkingSpaceObserver::class);

        GateFacade::define('contribute', fn (User $user): bool => $user->isEligibleForCommunity());

        LogViewer::auth(function ($request) {
            return $request->user() && ! $request->user()->suspended_at && $request->user()->hasRole(UserRole::ADMIN);
        });
    }
}
