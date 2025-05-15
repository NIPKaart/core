<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\App\UpdateUserParkingSpot;
use App\Models\Country;
use App\Models\Province;
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
    public function edit(UserParkingSpot $userParkingSpot)
    {
        Gate::authorize('update', $userParkingSpot);

        $spot = UserParkingSpot::with(['user', 'province', 'country'])->findOrFail($userParkingSpot->id);

        $statuses = collect(ParkingStatus::cases())->map(fn ($status) => [
            'value' => $status->value,
            'label' => $status->label(),
            'description' => $status->description(),
        ])->values();

        $countries = Country::select('id', 'name')->get();
        $provinces = Province::select('id', 'name')->get();

        return inertia('backend/parking-spots/edit', [
            'spot' => $spot,
            'countries' => $countries,
            'provinces' => $provinces,
            'selectOptions' => [
                'statuses' => $statuses,
                'orientation' => ParkingOrientation::options(),
            ],
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateUserParkingSpot $request, UserParkingSpot $userParkingSpot)
    {
        Gate::authorize('update', $userParkingSpot);

        $parkingTime = ($request->integer('parking_hours') ?? 0) * 60 + ($request->integer('parking_minutes') ?? 0);

        $data = [
            ...$request->validated(),
            'parking_time' => $parkingTime > 0 ? $parkingTime : null,
            'parking_disc' => $parkingTime > 0,
        ];
        unset($data['parking_hours'], $data['parking_minutes']);

        $userParkingSpot->update($data);

        return redirect()
            ->route('app.user-parking-spots.index')
            ->with('success', 'Parking spot updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
