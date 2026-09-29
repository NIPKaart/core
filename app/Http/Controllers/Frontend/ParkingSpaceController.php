<?php

namespace App\Http\Controllers\Frontend;

use App\Enums\ParkingConfirmationStatus;
use App\Http\Controllers\Controller;
use Inertia\Inertia;

class ParkingSpaceController extends Controller
{
    /**
     * Frontend - map page.
     */
    public function map()
    {
        return Inertia::render('frontend/map/index', [
            'selectOptions' => [
                'confirmationStatus' => ParkingConfirmationStatus::options(),
            ],
        ]);
    }
}
