<?php

namespace App\Http\Controllers;

use App\Enums\ParkingConfirmationStatus;
use App\Models\ParkingSpot;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class ParkingSpotConfirmationController extends Controller
{
    public function store(Request $request, ParkingSpot $parkingSpot)
    {
        $request->validate([
            'status' => ['required', 'string', Rule::in(ParkingConfirmationStatus::all())],
            'comment' => ['nullable', 'string', 'max:500'],
        ]);

        $user = Auth::user();

        $alreadyConfirmed = $parkingSpot->confirmations()
            ->where('user_id', $user->id)
            ->whereDate('confirmed_at', now()->toDateString())
            ->exists();

        if ($alreadyConfirmed) {
            return redirect()->back()->withErrors([
                'general' => 'You already confirmed this spot today.'
            ])->withInput();
        }

        $parkingSpot->confirmations()->create([
            'user_id'     => $user->id,
            'confirmed_at'=> now(),
            'status'      => $request->input('status'),
            'comment'     => $request->input('comment') ?? null,
        ]);

        return redirect()->back()->with('success', 'Confirmation recorded successfully.');
    }
}
