<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SecurityController extends Controller
{
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/security', [
            'twoFactorEnabled' => $request->user()->hasEnabledTwoFactorAuthentication(),
            'twoFactorPending' => (bool) $request->user()->two_factor_secret && ! $request->user()->hasEnabledTwoFactorAuthentication(),
            'passkeys' => $request->user()->passkeys()->latest()->get(['id', 'name', 'created_at', 'last_used_at'])->map(fn ($passkey) => $passkey->only(['id', 'name', 'created_at', 'last_used_at'])),
        ]);
    }
}
