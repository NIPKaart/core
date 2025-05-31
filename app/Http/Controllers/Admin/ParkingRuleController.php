<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\App\StoreParkingRuleRequest;
use App\Http\Requests\App\UpdateParkingRuleRequest;
use App\Models\Country;
use App\Models\ParkingMunicipal;
use App\Models\ParkingRule;
use App\Models\ParkingSpot;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class ParkingRuleController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        Gate::authorize('viewAny', ParkingRule::class);

        $countries = Country::all();
        $existingMunicipalities = ParkingRule::pluck('municipality')->toArray();

        $parkingSpots = ParkingSpot::whereNotIn('municipality', $existingMunicipalities)
            ->pluck('municipality');

        $municipalSpots = ParkingMunicipal::whereNotIn('municipality', $existingMunicipalities)
            ->pluck('municipality');

        $availableMunicipalities = $parkingSpots
            ->concat($municipalSpots)
            ->unique()
            ->sort()
            ->values();

        return Inertia::render('backend/parking-rules/index', [
            'parkingRules' => ParkingRule::with('country')->paginate(20),
            'countries' => $countries,
            'municipalities' => $availableMunicipalities,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        // Modal for creating a new parking rule
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreParkingRuleRequest $request)
    {
        Gate::authorize('create', ParkingRule::class);

        ParkingRule::create($request->validated());

        return redirect()->route('app.parking-rules.index');
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
    public function edit(ParkingRule $parkingRule)
    {
        // Modal for editing an existing parking rule
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateParkingRuleRequest $request, ParkingRule $parkingRule)
    {
        Gate::authorize('update', $parkingRule);

        $parkingRule->update($request->validated());

        return redirect()
            ->route('app.parking-rules.index');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ParkingRule $parkingRule)
    {
        Gate::authorize('delete', ParkingRule::class);

        $parkingRule->delete();

        return redirect()->route('app.parking-rules.index');
    }
}
