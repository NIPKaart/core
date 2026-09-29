<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\App\StoreUserRequest;
use App\Http\Requests\App\UpdateUserRequest;
use App\Models\Role;
use App\Models\User;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class UserController extends Controller
{
    /**
     * Users who signed in within this many days count as recently signed in.
     */
    private const int RECENT_LOGIN_DAYS = 30;

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        Gate::authorize('viewAny', User::class);

        $filters = [
            'role' => $this->selectedValues($request, 'role', [...UserRole::all(), 'none']),
            'status' => $this->selectedValues($request, 'status', ['active', 'suspended']),
            'verification' => $this->selectedValues($request, 'verification', ['verified', 'unverified']),
            'login' => $this->selectedValues($request, 'login', ['recent', 'none']),
        ];

        $users = User::query()
            ->with('roles:id,name')
            ->tap(fn (Builder $query) => $this->applyFilters($query, $filters))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('backend/users/index', [
            'users' => $users,
            'filters' => $filters,
            'facets' => $this->facets(),
            'roleOptions' => collect(UserRole::cases())->map(fn (UserRole $role): array => ['value' => $role->value, 'label' => $role->label()]),
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        Gate::authorize('create', User::class);

        return Inertia::render('backend/users/create', [
            'roles' => Role::select('id', 'name')->get(),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreUserRequest $request)
    {
        Gate::authorize('create', User::class);

        $data = $request->validated();
        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);
        $user->syncRoles($data['role']);

        Inertia::flash('success', 'User created successfully');

        return redirect()->route('app.users.index');
    }

    /**
     * Display the specified resource.
     */
    public function show(User $user)
    {
        Gate::authorize('view', User::class);

        return Inertia::render('backend/users/show', [
            'user' => $user,
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(User $user)
    {
        Gate::authorize('update', $user);

        $roles = Role::select('id', 'name')->get();

        return Inertia::render('backend/users/edit', [
            'user' => $user,
            'userRole' => $user->roles()->pluck('name')->first(),
            'roles' => $roles,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateUserRequest $request, User $user)
    {
        Gate::authorize('update', $user);

        $data = $request->validated();

        $user->fill([
            'name' => $data['name'],
            'email' => $data['email'],
        ]);

        if (! empty($data['password'])) {
            $user->password = Hash::make($data['password']);
        }

        $user->save();
        $user->syncRoles($data['role']);

        Inertia::flash('success', 'User updated successfully');

        return redirect()->route('app.users.index');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(User $user)
    {
        Gate::authorize('delete', User::class);

        $user->delete();

        return redirect()->route('app.users.index');
    }

    /**
     * Suspend or unsuspend the specified user.
     */
    public function suspend(User $user)
    {
        if (auth()->id() === $user->id) {
            return redirect()->back()->withErrors(['suspended_at' => 'You cannot suspend yourself.']);
        }

        $user->suspended_at = $user->suspended_at ? null : now();
        $user->save();

        return redirect()->back();
    }

    /**
     * Read a comma-separated filter from the query string, keeping only allowed values.
     *
     * @param  list<string>  $allowed
     * @return list<string>
     */
    private function selectedValues(Request $request, string $key, array $allowed): array
    {
        return array_values(array_intersect(explode(',', $request->string($key)->toString()), $allowed));
    }

    /**
     * @param  Builder<User>  $query
     * @param  array{role: list<string>, status: list<string>, verification: list<string>, login: list<string>}  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        $this->whereAnyOf($query, $filters['role'], [
            'none' => fn (Builder $query) => $query->doesntHave('roles'),
            ...collect(UserRole::all())->mapWithKeys(fn (string $role): array => [$role => fn (Builder $query) => $query->role($role)])->all(),
        ]);
        $this->whereAnyOf($query, $filters['status'], [
            'active' => fn (Builder $query) => $query->whereNull('suspended_at'),
            'suspended' => fn (Builder $query) => $query->whereNotNull('suspended_at'),
        ]);
        $this->whereAnyOf($query, $filters['verification'], [
            'verified' => fn (Builder $query) => $query->whereNotNull('email_verified_at'),
            'unverified' => fn (Builder $query) => $query->whereNull('email_verified_at'),
        ]);
        $this->whereAnyOf($query, $filters['login'], [
            'recent' => fn (Builder $query) => $query->where('last_login_at', '>=', now()->subDays(self::RECENT_LOGIN_DAYS)),
            'none' => fn (Builder $query) => $query->whereNull('last_login_at'),
        ]);
    }

    /**
     * Match users that satisfy at least one selected option of a facet.
     *
     * @param  Builder<User>  $query
     * @param  list<string>  $selected
     * @param  array<string, Closure(Builder<User>): mixed>  $conditions
     */
    private function whereAnyOf(Builder $query, array $selected, array $conditions): void
    {
        if ($selected === []) {
            return;
        }

        $query->where(function (Builder $query) use ($selected, $conditions): void {
            foreach ($selected as $value) {
                $query->orWhere(fn (Builder $query) => $conditions[$value]($query));
            }
        });
    }

    /**
     * Count the users behind every facet option.
     *
     * @return array{role: array<string, int>, status: array<string, int>, verification: array<string, int>, login: array<string, int>}
     */
    private function facets(): array
    {
        return [
            'role' => [
                ...collect(UserRole::all())->mapWithKeys(fn (string $role): array => [$role => User::role($role)->count()])->all(),
                'none' => User::doesntHave('roles')->count(),
            ],
            'status' => [
                'active' => User::whereNull('suspended_at')->count(),
                'suspended' => User::whereNotNull('suspended_at')->count(),
            ],
            'verification' => [
                'verified' => User::whereNotNull('email_verified_at')->count(),
                'unverified' => User::whereNull('email_verified_at')->count(),
            ],
            'login' => [
                'recent' => User::where('last_login_at', '>=', now()->subDays(self::RECENT_LOGIN_DAYS))->count(),
                'none' => User::whereNull('last_login_at')->count(),
            ],
        ];
    }
}
