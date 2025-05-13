<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Models\UserParkingSpot;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class ParkingSpotController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        Gate::authorize('viewAny', UserParkingSpot::class);

        $query = UserParkingSpot::query()
            ->with(['user', 'province', 'country']);

        if ($request->filled('status')) {
            $statuses = explode(',', $request->input('status'));
            $query->whereIn('status', $statuses);
        }

        if ($request->filled('municipality')) {
            $municipalities = explode(',', $request->input('municipality'));
            $query->whereIn('municipality', $municipalities);
        }

        $spots = $query->latest()->paginate(25)->withQueryString();

        return inertia('backend/parking-spots/index', [
            'spots' => $spots,
            'filters' => [
                'status' => $request->input('status'),
                'municipality' => $request->input('municipality'),
                'deletion_requested' => $request->boolean('deletion_requested'),
            ],
            'statuses' => ParkingStatus::options(),
            'municipalities' => UserParkingSpot::select('municipality')->distinct()->orderBy('municipality')->pluck('municipality')->filter()->values(),
        ]);
    }


    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
