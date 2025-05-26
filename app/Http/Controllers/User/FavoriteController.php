<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpot;
use Illuminate\Http\Request;
use Inertia\Inertia;

class FavoriteController extends Controller
{
    /**
     * Display a listing of the user's favorites.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $favorites = $user->favorites()
            ->with([
                'favoritable' => function ($morphTo) {
                    $morphTo
                        ->morphWith([
                            ParkingSpot::class => ['country'],
                            ParkingMunicipal::class => [],
                            ParkingOffstreet::class => [],
                        ]);
                },
            ])
            ->get();

        $favoritesForFrontend = $favorites->map(function ($fav) {
            $type = class_basename($fav->favoritable_type);
            $f = $fav->favoritable;

            if (! $f) {
                return [
                    'id' => null,
                    'type' => $type,
                    'title' => '[removed]',
                ];
            }

            return match ($type) {
                'ParkingSpot' => [
                    'id' => $f->id,
                    'type' => $type,
                    'title' => $f->street,
                    'municipality' => $f->municipality,
                    'country' => $f->country?->name,
                    'latitude' => $f->latitude,
                    'longitude' => $f->longitude,
                ],
                'ParkingMunicipal', 'ParkingOffstreet' => [
                    'id' => $f->id,
                    'type' => $type,
                    'title' => $f->name,
                    'address' => $f->address ?? null,
                    'city' => $f->city ?? null,
                    'latitude' => $f->latitude,
                    'longitude' => $f->longitude,
                ],
                default => [
                    'id' => $f->id,
                    'type' => $type,
                    'title' => '[unknown]',
                ]
            };
        });

        return Inertia::render('backend/favorites/index', [
            'favorites' => $favoritesForFrontend,
        ]);
    }

    /**
     * Store a new favorite for the authenticated user.
     */
    public function store(Request $request)
    {
        $request->validate([
            'type' => ['required', 'in:parking_spot,parking_municipal,parking_offstreet'],
            'id' => ['required', 'string'],
        ]);

        $user = $request->user();
        $model = $this->findModel($request->type, $request->id);

        if (! $model->favoritedByUsers()->where('user_id', $user->id)->exists()) {
            $model->favoritedByUsers()->attach($user->id);
        }

        return redirect()->back();
    }

    /**
     * Remove a favorite for the authenticated user.
     */
    public function destroy(Request $request)
    {
        $request->validate([
            'type' => ['required', 'in:parking_spot,parking_municipal,parking_offstreet'],
            'id' => ['required', 'string'],
        ]);

        $user = $request->user();
        $model = $this->findModel($request->type, $request->id);

        if ($model->favoritedByUsers()->where('user_id', $user->id)->exists()) {
            $model->favoritedByUsers()->detach($user->id);
        }

        return redirect()->back();
    }

    /**
     * Find the model based on the type and ID.
     */
    private function findModel($type, $id)
    {
        return match ($type) {
            'parking_spot' => ParkingSpot::findOrFail($id),
            'parking_municipal' => ParkingMunicipal::findOrFail($id),
            'parking_offstreet' => ParkingOffstreet::findOrFail($id),
            default => abort(404),
        };
    }
}
