<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Http\Resources\FavoriteResource;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
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
                            ParkingSpace::class => ['country'],
                            ParkingMunicipal::class => [],
                            ParkingOffstreet::class => [],
                        ]);
                },
            ])
            ->get();

        return Inertia::render('backend/user/favorites/index', [
            'favorites' => FavoriteResource::collection($favorites)->toArray($request),
        ]);
    }

    /**
     * List the user's favorites as JSON.
     */
    public function list(Request $request)
    {
        $user = $request->user();
        $favorites = $user->favorites()
            ->with([
                'favoritable' => function ($morphTo) {
                    $morphTo->morphWith([
                        ParkingSpace::class => ['country'],
                        ParkingMunicipal::class => [],
                        ParkingOffstreet::class => [],
                    ]);
                },
            ])
            ->get();

        return response()->json([
            'favorites' => FavoriteResource::collection($favorites)->toArray($request),
        ]);
    }

    /**
     * Store a new favorite for the authenticated user.
     */
    public function store(Request $request)
    {
        $request->validate([
            'type' => ['required', 'in:parking_space,parking_municipal,parking_offstreet'],
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
            'type' => ['required', 'in:parking_space,parking_municipal,parking_offstreet'],
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
            'parking_space' => ParkingSpace::findOrFail($id),
            'parking_municipal' => ParkingMunicipal::findOrFail($id),
            'parking_offstreet' => ParkingOffstreet::findOrFail($id),
            default => abort(404),
        };
    }
}
