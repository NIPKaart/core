<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use Inertia\Inertia;

class AboutController extends Controller
{
    /**
     * Frontend - Render the about page.
     */
    public function index()
    {
        return Inertia::render('frontend/about');
    }
}
