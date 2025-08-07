<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use Inertia\Inertia;

class GarageController extends Controller
{
    /**
     * Frontend - Render the garages page.
     */
    public function index()
    {
        return Inertia::render('frontend/garages');
    }
}
