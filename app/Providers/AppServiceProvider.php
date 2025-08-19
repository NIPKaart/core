<?php

namespace App\Providers;

use App\Enums\UserRole;
use App\Models\ParkingSpace;
use App\Observers\ParkingSpaceObserver;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Opcodes\LogViewer\Facades\LogViewer;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Model::automaticallyEagerLoadRelationships();

        Model::shouldBeStrict(! $this->app->isProduction());
        DB::prohibitDestructiveCommands($this->app->isProduction());

        ParkingSpace::observe(ParkingSpaceObserver::class);

        LogViewer::auth(function ($request) {
            return $request->user() && $request->user()->hasRole(UserRole::ADMIN);
        });
    }
}
