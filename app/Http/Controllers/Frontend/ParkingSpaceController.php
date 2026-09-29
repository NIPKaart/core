<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class ParkingSpaceController extends Controller
{
    /**
     * Frontend - map page.
     */
    public function map(): Response
    {
        return Inertia::render('frontend/map/index');
    }
}
