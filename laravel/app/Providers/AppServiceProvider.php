<?php

namespace App\Providers;

use App\Models\Role;
use App\Policies\RolePolicy;
use BezhanSalleh\PanelSwitch\PanelSwitch;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{

    public $singletons = [
        \Filament\Http\Responses\Auth\LoginResponse::class => \App\Http\Responses\LoginResponse::class,
        \Filament\Http\Responses\Auth\LogoutResponse::class => \App\Http\Responses\LogoutResponse::class,
    ];
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
        Gate::policy(Role::class, RolePolicy::class);

        PanelSwitch::configureUsing(function (PanelSwitch $panelSwitch) {
            $panelSwitch
                // ->simple()
                ->modalWidth('sm')
                ->modalHeading('Switch between panels')
                ->iconSize(24)
                ->icons([
                    'admin' => 'heroicon-o-building-office',
                    'app' => 'heroicon-o-user',
                ])
                ->labels([
                    'app' => 'User Panel',
                    'admin' => 'Admin Panel',
                ])
                ->visible(fn (): bool => auth()->user()?->hasAnyRole([
                    'admin',
                    'manager',
                ]));
        });
    }
}
