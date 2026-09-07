<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ParkingTextSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function search(Request $request, ParkingTextSearch $search): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:200'],
            'limit' => ['sometimes', 'integer'],
        ]);

        return response()->json($search->search($validated['q'] ?? '', (int) ($validated['limit'] ?? 10)));
    }
}
