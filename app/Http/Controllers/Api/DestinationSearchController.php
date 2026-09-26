<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\InternalDestinationSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DestinationSearchController extends Controller
{
    public function suggestions(Request $request, InternalDestinationSearch $search): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:200'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:10'],
        ]);

        return response()->json([
            'results' => $search->search($validated['q'], (int) ($validated['limit'] ?? 5)),
        ]);
    }
}
