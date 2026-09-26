<?php

namespace App\Providers;

use App\Contracts\DestinationGeocoder;
use App\Enums\UserRole;
use App\Models\ParkingSpace;
use App\Observers\ParkingSpaceObserver;
use App\Services\GeoapifyDestinationGeocoder;
use App\Services\MunicipalDeliveryStorage;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
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
        $this->app->bind(DestinationGeocoder::class, GeoapifyDestinationGeocoder::class);
        $this->app->bind(MunicipalDeliveryStorage::class, fn () => new MunicipalDeliveryStorage(Storage::disk('municipal-deliveries')->getClient()));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Model::automaticallyEagerLoadRelationships();

        Model::shouldBeStrict(! $this->app->isProduction());
        DB::prohibitDestructiveCommands($this->app->isProduction());

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)->mixedCase()->letters()->numbers()->symbols()->uncompromised()
            : null);

        ParkingSpace::observe(ParkingSpaceObserver::class);

        LogViewer::auth(function ($request) {
            return $request->user() && ! $request->user()->suspended_at && $request->user()->hasRole(UserRole::ADMIN);
        });
    }
}
