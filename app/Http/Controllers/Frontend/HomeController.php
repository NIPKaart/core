<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use Inertia\Inertia;

class HomeController extends Controller
{
    /**
     * Frontend - Render the home page.
     */
    public function index()
    {
        return Inertia::render('frontend/home');
    }
}
