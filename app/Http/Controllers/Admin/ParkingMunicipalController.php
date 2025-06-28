<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ParkingOrientation;
use App\Http\Controllers\Controller;
use App\Http\Requests\App\UpdateParkingMunicipalRequest;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class ParkingMunicipalController extends Controller
{
    /**
     * Show a list of municipalities with stats and links.
     */
    public function municipalities()
    {
        Gate::authorize('viewAny', ParkingMunicipal::class);

        $municipalities = Municipality::withCount([
            'parkingMunicipal as total_spaces' => fn ($q) => $q->where('visibility', true),
        ])
            ->with(['parkingMunicipal' => fn ($q) => $q->where('visibility', true)->latest('updated_at')])
            ->whereHas('parkingMunicipal')
            ->orderBy('name')
            ->get()
            ->map(function ($municipality) {
                return [
                    'id' => $municipality->id,
                    'name' => $municipality->name,
                    'total_spaces' => $municipality->total_spaces,
                    'last_updated' => optional($municipality->parkingMunicipal->first())->updated_at,
                ];
            });

        return Inertia::render('backend/parking-municipal/municipalities', [
            'municipalities' => $municipalities,
        ]);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request, Municipality $municipality)
    {
        Gate::authorize('viewAny', ParkingMunicipal::class);

        $query = ParkingMunicipal::with(['municipality', 'country', 'province'])
            ->where('municipality_id', $municipality->id);

        // Filters
        if ($request->filled('visibility')) {
            $query->where('visibility', filter_var($request->input('visibility'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('orientation')) {
            $orientations = explode(',', $request->input('orientation'));
            if (in_array('unknown', $orientations)) {
                $query->where(function ($q) use ($orientations) {
                    $q->whereIn('orientation', array_filter($orientations, fn ($o) => $o !== 'unknown'));
                    $q->orWhereNull('orientation');
                });
            } else {
                $query->whereIn('orientation', $orientations);
            }
        }

        $spaces = $query->orderByDesc('visibility')->orderBy('street')->paginate(50)->withQueryString();

        return Inertia::render('backend/parking-municipal/index', [
            'municipality' => $municipality,
            'spaces' => $spaces,
            'filters' => [
                'visibility' => $request->input('visibility'),
                'orientation' => $request->input('orientation'),
            ],
            'options' => [
                'orientations' => ParkingOrientation::options(),
            ],
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
    public function show(ParkingMunicipal $parkingMunicipal)
    {
        Gate::authorize('view', $parkingMunicipal);

        return Inertia::render('backend/parking-municipal/show', [
            'parkingMunicipal' => $parkingMunicipal->load(['municipality', 'country', 'province']),
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(ParkingMunicipal $parkingMunicipal)
    {
        Gate::authorize('update', $parkingMunicipal);

        return Inertia::render('backend/parking-municipal/edit', [
            'parkingMunicipal' => $parkingMunicipal->load(['municipality', 'country', 'province']),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateParkingMunicipalRequest $request, ParkingMunicipal $parkingMunicipal)
    {
        Gate::authorize('update', $parkingMunicipal);

        $parkingMunicipal->update($request->validated());

        return redirect()->route('app.parking-municipal.index', ['municipality' => $parkingMunicipal->municipality_id])
            ->with('success', 'Parking space updated.');
    }

    /**
     * Toggle visibility of parking spaces.
     */
    public function toggleVisibility(Request $request, ParkingMunicipal $parkingMunicipal)
    {
        Gate::authorize('update', $parkingMunicipal);

        $ids = (array) $request->input('ids', []);
        $visibility = $request->boolean('visibility', true);

        ParkingMunicipal::whereIn('id', $ids)->update(['visibility' => $visibility]);

        return back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ParkingMunicipal $parkingMunicipal)
    {
        Gate::authorize('delete', $parkingMunicipal);

        $parkingMunicipal->delete();

        return back()->with('success', 'Parking space deleted.');
    }
}
