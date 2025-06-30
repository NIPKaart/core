<?php

namespace App\Http\Controllers;

use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Http\Requests\StoreLocationRequest;
use App\Models\Country;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use App\Traits\FindsOrCreatesMunicipality;
use App\Traits\FindsOrCreatesProvince;
use App\Traits\ParsesNominatimAddress;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class ParkingSpaceController extends Controller
{
    use FindsOrCreatesMunicipality;
    use FindsOrCreatesProvince;
    use ParsesNominatimAddress;

    /**
     * Frontend - map page.
     */
    public function map()
    {
        $parkingSpaces = ParkingSpace::select('id', 'latitude', 'longitude', 'created_at', 'orientation')
            ->where('status', ParkingStatus::APPROVED)->get();
        $municipalSpaces = ParkingMunicipal::select('id', 'latitude', 'longitude', 'orientation')
            ->where('visibility', true)->get();
        $offstreetSpaces = ParkingOffstreet::select('id', 'latitude', 'longitude', 'free_space_short', 'short_capacity', 'api_state')
            ->where('visibility', true)->get();

        return Inertia::render('frontend/map/index', [
            'parkingSpaces' => $parkingSpaces,
            'municipalSpaces' => $municipalSpaces,
            'offstreetSpaces' => $offstreetSpaces,
            'selectOptions' => [
                'confirmationStatus' => ParkingConfirmationStatus::options(),
            ],
        ]);
    }

    /**
     * Frontend - add new location page.
     */
    public function locationAdd()
    {
        $parkingSpaces = ParkingSpace::select('id', 'latitude', 'longitude', 'status')->get();

        return Inertia::render('frontend/map/create', [
            'parkingSpaces' => $parkingSpaces,
            'selectOptions' => [
                'orientation' => ParkingOrientation::options(),
            ],
        ]);
    }

    /**
     * Store the parking location information.
     */
    public function store(StoreLocationRequest $request)
    {
        $validated = $request->validated();
        $address = $validated['nominatim'];

        try {
            $countryId = Country::where('code', strtoupper($address['country_code'] ?? ''))->value('id');
            $province = $this->findOrCreateProvince(
                $address['state'] ?? $address['city'] ?? 'unknown',
                $countryId,
                $address['ISO3166-2-lvl6'] ?? $address['ISO3166-2-lvl4'] ?? null,
            );
            $municipality = $this->findOrCreateMunicipality(
                $this->getMunicipality($address),
                $countryId,
                $province->id
            );

            $parkingSpace = new ParkingSpace([
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
                'province_id' => $province->id,
                'municipality_id' => $municipality->id,
                'city' => $this->getCity($address),
                'suburb' => $this->getSuburb($address),
                'neighbourhood' => $this->getNeighbourhood($address),
                'postcode' => str_replace(' ', '', $address['postcode'] ?? ''),
                'street' => $this->getStreet($address),
                'amenity' => $this->getAmenity($address),
            ]);

            $parkingSpace->save();

            return redirect()->route('map');
        } catch (\Throwable $e) {
            Log::error('Error storing parking location', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->withErrors([
                'general' => 'Something went wrong while saving the parking location. Please try again later.',
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
