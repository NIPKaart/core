<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use Inertia\Inertia;

class ContactController extends Controller
{
    /**
     * Frontend - Render the contact page.
     */
    public function index()
    {
        return Inertia::render('frontend/contact');
    }
}
