<?php

namespace App\Http\Controllers\Settings;

use App\Enums\SupportedLocale;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LocaleController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate(['locale' => ['required', Rule::enum(SupportedLocale::class)]]);

        $request->user()?->update(['locale' => $validated['locale']]);

        return back()->withCookie(cookie('locale', $validated['locale'], 525600));
    }
}
