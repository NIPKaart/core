<?php

namespace App\Http\Controllers;

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Http\Requests\StoreLocationRequest;
use App\Models\Country;
use App\Models\ParkingSpot;
use App\Models\Province;
use App\Traits\ParsesNominatimAddress;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class LocationController extends Controller
{
    use ParsesNominatimAddress;

    /**
     * Frontend - map page.
     */
    public function map()
    {
        $parkingSpots = ParkingSpot::select('id', 'latitude', 'longitude', 'created_at', 'orientation')
            ->where('status', ParkingStatus::APPROVED)->get();

        return Inertia::render('frontend/map', [
            'parkingSpots' => $parkingSpots,
        ]);
    }

    /**
     * Frontend - add new location page.
     */
    public function locationAdd()
    {
        return Inertia::render('frontend/add-location', [
            'selectOptions' => [
                'orientation' => ParkingOrientation::options(),
            ],
        ]);
    }

    /**
     * Retrieve the parking location information.
     */
    public function getLocationInfo() {}

    /**
     * Store the parking location information.
     */
    public function store(StoreLocationRequest $request)
    {
        $validated = $request->validated();
        $address = $validated['nominatim'];

        try {
            $countryId = Country::where('code', strtoupper($address['country_code'] ?? ''))->value('id');
            $provinceId = Province::firstOrCreate([
                'country_id' => $countryId,
                'name' => $address['state'] ?? $address['city'] ?? 'unknown',
                'geocode' => $address['ISO3166-2-lvl6'] ?? $address['ISO3166-2-lvl4'] ?? null,
            ])->id;

            $spot = new ParkingSpot([
                'id' => uniqid(),
                'user_id' => Auth::id(),
                'ip_address' => $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $request->getClientIp(),
                'latitude' => $validated['latitude'],
                'longitude' => $validated['longitude'],
                'orientation' => $validated['orientation'],
                'parking_time' => $this->calculateParkingTime($validated['parking_hours'], $validated['parking_minutes']),
                'parking_disc' => ! empty($validated['parking_hours']) || ! empty($validated['parking_minutes']),
                'window_times' => $validated['window_times'],
                'description' => $validated['message'],
                'status' => ParkingStatus::PENDING,
                'country_id' => $countryId,
                'province_id' => $provinceId,
                'municipality' => $this->getMunicipality($address),
                'city' => $this->getCity($address),
                'suburb' => $this->getSuburb($address),
                'neighbourhood' => $this->getNeighbourhood($address),
                'postcode' => str_replace(' ', '', $address['postcode'] ?? ''),
                'street' => $this->getStreet($address),
                'amenity' => $this->getAmenity($address),
            ]);

            $spot->save();

            return redirect()->route('map');
        } catch (\Throwable $e) {
            Log::error('Error storing location', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->withErrors([
                'general' => 'Something went wrong while saving the location. Please try again later.',
            ])->withInput();
        }
    }

    /**
     * Get the parking time in minutes.
     */
    private function calculateParkingTime($hours, $minutes): ?int
    {
        if (empty($hours) && empty($minutes)) {
            return null;
        }

        return ((int) $hours * 60) + (int) $minutes;
    }
}
