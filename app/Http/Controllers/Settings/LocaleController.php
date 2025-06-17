<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LocaleController extends Controller
{
    public function update(Request $request)
    {
        $request->validate([
            'locale' => ['required', 'in:nl,en'],
        ]);

        $user = Auth::user();
        $user->locale = $request->input('locale');
        $user->save();

        return back();
    }
}
