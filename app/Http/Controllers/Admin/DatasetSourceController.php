<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DatasetSource;
use App\Services\SourceRegistrar;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class DatasetSourceController extends Controller
{
    /** Approve or reject a discovered source (ADR 0013). */
    public function update(Request $request, DatasetSource $datasetSource, SourceRegistrar $registrar): RedirectResponse
    {
        Gate::authorize('approve', $datasetSource);
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);
        if ($data['decision'] === 'approve') {
            $registrar->approve($datasetSource, $request->user(), $data['reason'] ?? null);
        } else {
            $registrar->reject($datasetSource, $request->user(), $data['reason'] ?? null);
        }

        return to_route('app.imports.index', ['tab' => 'sources', 'dataset' => $datasetSource->id]);
    }
}
