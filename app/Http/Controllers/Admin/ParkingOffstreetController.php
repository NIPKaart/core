<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Country;
use App\Models\Municipality;
use App\Models\ParkingOffstreet;
use App\Models\Province;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ParkingOffstreetController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', ParkingOffstreet::class);

        $query = ParkingOffstreet::query()->with(['country', 'province', 'municipality']);

        // Filters
        if ($request->filled('country_id')) {
            $countryIds = explode(',', $request->input('country_id'));
            $query->whereIn('country_id', $countryIds);
        }
        if ($request->filled('province_id')) {
            $provinceIds = explode(',', $request->input('province_id'));
            $query->whereIn('province_id', $provinceIds);
        }
        if ($request->filled('municipality_id')) {
            $municipalityIds = explode(',', $request->input('municipality_id'));
            $query->whereIn('municipality_id', $municipalityIds);
        }
        if ($request->filled('visibility')) {
            $query->where('visibility', filter_var($request->input('visibility'), FILTER_VALIDATE_BOOLEAN));
        }

        $spaces = $query->latest()->paginate(25)->withQueryString();

        return inertia('backend/parking-offstreet/index', [
            'spaces' => $spaces,
            'filters' => [
                'country_id' => $request->input('country_id'),
                'province_id' => $request->input('province_id'),
                'municipality_id' => $request->input('municipality_id'),
                'visibility' => $request->input('visibility'),
            ],
            'options' => [
                'countries' => Country::select('id', 'name')->orderBy('name')->get(),
                'provinces' => Province::select('id', 'name')->orderBy('name')->get(),
                'municipalities' => Municipality::select('id', 'name')->orderBy('name')->get(),
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
     * Toggle visibility of parking offstreet spaces.
     */
    public function toggleVisibility(Request $request, ParkingOffstreet $parkingOffstreet)
    {
        Gate::authorize('update', $parkingOffstreet);

        $ids = (array) $request->input('ids', []);
        $visibility = $request->boolean('visibility', true);

        ParkingOffstreet::whereIn('id', $ids)->update(['visibility' => $visibility]);

        return back();
    }

    /**
     * Toggle visibility of multiple parking offstreet spaces.
     */
    public function bulkSetVisibility(Request $request)
    {
        Gate::authorize('bulkUpdate', ParkingOffstreet::class);

        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'string',
            'visibility' => 'required|boolean',
        ]);

        ParkingOffstreet::whereIn('id', $validated['ids'])
            ->update(['visibility' => $validated['visibility']]);

        return back();
    }
}
