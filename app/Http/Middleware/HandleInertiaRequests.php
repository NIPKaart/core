<?php

namespace App\Http\Middleware;

use App\Models\ParkingSpace;
use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'locale' => App::getLocale(),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'flash' => [
                'success' => session('success'),
                'error' => session('error'),
                'warning' => session('warning'),
                'info' => session('info'),
            ],
            'auth' => [
                'user' => $request->user(),
                'roles' => $request->user()?->roles->pluck('name')->all() ?? [],
                'can' => $request->user()
                    ? $request->user()
                        ->getAllPermissions()
                        ->pluck('name')
                        ->mapWithKeys(fn ($perm) => [$perm => true])
                        ->all()
                    : [],
            ],
            'notifications' => fn () => auth()->check() ? [
                'unread' => auth()->user()->unreadNotifications()->count(),
                'recent' => auth()->user()->unreadNotifications()
                    ->latest()
                    ->limit(5)
                    ->get()
                    ->map(fn ($n) => [
                        'id' => (string) $n->id,
                        'type' => $n->type,
                        'data' => (array) $n->data,
                        'read_at' => optional($n->read_at)?->toIso8601String(),
                        'created_at' => optional($n->created_at)?->toIso8601String(),
                    ]),
            ] : ['unread' => 0, 'recent' => []],
            'ziggy' => fn (): array => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'counts' => function () {
                return [
                    'users' => User::count(),
                    'parkingSpaces' => [
                        'active' => ParkingSpace::count(),
                        'trashed' => ParkingSpace::onlyTrashed()->count(),
                    ],
                    'userParkingSpaces' => [
                        'active' => ParkingSpace::where('user_id', auth()->id())->count(),
                    ],
                ];
            },
        ];
    }
}
