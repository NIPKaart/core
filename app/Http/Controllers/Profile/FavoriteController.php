<?php

namespace App\Http\Controllers\Profile;

use App\Enums\ParkingStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\FavoriteResource;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
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

        return Inertia::render('backend/profile/favorites/index', [
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
            'id' => ['required', 'string', Rule::when($request->type === 'parking_space', ['uuid'])],
        ]);

        $user = $request->user();
        $model = $this->findModel($request->type, $request->id);

        $user->favorites()->firstOrCreate([
            'favoritable_type' => $model->getMorphClass(),
            'favoritable_id' => (string) $model->getKey(),
        ]);

        return redirect()->back();
    }

    /**
     * Remove a favorite for the authenticated user.
     */
    public function destroy(Request $request)
    {
        $request->validate([
            'favorite_id' => ['sometimes', 'required', 'integer'],
            'type' => ['required_without:favorite_id', 'in:parking_space,parking_municipal,parking_offstreet'],
            'id' => ['required_without:favorite_id', 'string'],
        ]);

        $user = $request->user();
        if ($request->has('favorite_id')) {
            $user->favorites()->findOrFail($request->integer('favorite_id'))->delete();
        } else {
            $modelClass = $this->modelClass($request->type);
            $user->favorites()->where('favoritable_type', (new $modelClass)->getMorphClass())
                ->where('favoritable_id', $request->id)->delete();
        }

        return redirect()->back();
    }

    /**
     * Find the model based on the type and ID.
     */
    private function findModel($type, $id)
    {
        $modelClass = $this->modelClass($type);
        $query = $modelClass::query();
        $type === 'parking_space'
            ? $query->where('status', ParkingStatus::APPROVED)
            : $query->where('visibility', true);

        return $query->findOrFail($id);
    }

    private function modelClass(string $type): string
    {
        return match ($type) {
            'parking_space' => ParkingSpace::class,
            'parking_municipal' => ParkingMunicipal::class,
            'parking_offstreet' => ParkingOffstreet::class,
            default => abort(404),
        };
    }
}
