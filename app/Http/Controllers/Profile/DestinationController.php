<?php

namespace App\Http\Controllers\Profile;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDestinationRequest;
use App\Http\Resources\DestinationResource;
use App\Models\Destination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class DestinationController extends Controller
{
    public function list(Request $request): JsonResponse
    {
        return DestinationResource::collection($request->user()->destinations()->orderBy('label')->orderBy('id')->get())
            ->response()->header('Cache-Control', 'private, no-store');
    }

    public function store(StoreDestinationRequest $request): JsonResponse
    {
        $destination = $request->user()->destinations()->create($request->validated());

        return (new DestinationResource($destination))->response()->setStatusCode(201);
    }

    public function update(Request $request, Destination $destination): DestinationResource
    {
        Gate::authorize('update', $destination);
        $destination->update($request->validate(['label' => ['required', 'string', 'max:100']]));

        return new DestinationResource($destination);
    }

    public function destroy(Destination $destination): Response
    {
        Gate::authorize('delete', $destination);
        $destination->delete();

        return response()->noContent();
    }
}
