<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\ParkingDiscovery;
use Inertia\Inertia;
use Inertia\Response;

class AboutController extends Controller
{
    /**
     * Frontend - Render the about page.
     */
    public function index(ParkingDiscovery $discovery): Response
    {
        return Inertia::render('frontend/about', [
            'statistics' => fn () => $discovery->statistics(),
        ]);
    }
}
