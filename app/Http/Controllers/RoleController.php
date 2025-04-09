<?php

namespace App\Http\Controllers;

use App\Http\Requests\App\StoreRoleRequest;
use App\Http\Requests\App\UpdateRoleRequest;
use App\Models\Role;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;

class RoleController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        Gate::authorize('viewAny', Role::class);

        return Inertia::render('backend/roles/index', [
            'roles' => Role::all(),
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        Gate::authorize('create', Role::class);

        return Inertia::render('backend/roles/create', [
            'allPermissions' => Permission::all(),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreRoleRequest $request)
    {
        Gate::authorize('create', Role::class);

        $role = Role::create([
            'name' => strtolower($request->validated()['name']),
        ]);

        $role->syncPermissions($request->validated('permissions'));

        return redirect()->route('app.roles.index')->with('success', 'Role created successfully.');
    }

    /**
     * Display the specified resource.
     */
    public function show(Role $role)
    {
        Gate::authorize('view', Role::class);

        return Inertia::render('backend/roles/show', [
            'role' => $role,
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Role $role)
    {
        Gate::authorize('update', $role);

        return Inertia::render('backend/roles/edit', [
            'role' => $role,
            'rolePermissions' => $role->permissions()->pluck('id'),
            'allPermissions' => Permission::all(),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateRoleRequest $request, Role $role)
    {
        Gate::authorize('update', $role);

        $role->update([
            'name' => strtolower($request->validated()['name']),
        ]);

        $role->syncPermissions($request->validated('permissions'));

        return redirect()->route('app.roles.index')->with('success', 'Role updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Role $role)
    {
        Gate::authorize('delete', Role::class);

        $role->delete();

        return redirect()->route('app.roles.index');
    }
}
