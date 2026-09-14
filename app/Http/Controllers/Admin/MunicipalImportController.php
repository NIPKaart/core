<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\App\StoreMunicipalImportRequest;
use App\Models\DatasetSource;
use App\Models\MunicipalImport;
use App\Services\MunicipalImportService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class MunicipalImportController extends Controller
{
    public function index(): Response
    {
        Gate::authorize('viewAny', MunicipalImport::class);

        return Inertia::render('backend/municipal-imports/index', [
            'datasets' => DatasetSource::orderBy('name')->get(),
            'imports' => MunicipalImport::with('datasetSource:id,name')->latest('id')->paginate(20),
        ]);
    }

    public function store(StoreMunicipalImportRequest $request, MunicipalImportService $service): RedirectResponse
    {
        $import = $service->intake($request->file('file')->getContent(), $request->user());

        return to_route('app.municipal-imports.show', $import);
    }

    public function show(Request $request, MunicipalImport $municipalImport, MunicipalImportService $service): Response
    {
        Gate::authorize('view', $municipalImport);
        $review = $service->review($municipalImport);
        $page = max(1, min((int) $request->query('page', 1), max(1, (int) ceil(count($review['rows']) / 50))));
        $total = count($review['rows']);
        $review['rows'] = array_slice($review['rows'], ($page - 1) * 50, 50);

        return Inertia::render('backend/municipal-imports/show', [
            'import' => $municipalImport, 'dataset' => $municipalImport->datasetSource,
            'review' => $review, 'page' => $page, 'pages' => max(1, (int) ceil($total / 50)),
        ]);
    }

    public function update(Request $request, MunicipalImport $municipalImport, MunicipalImportService $service): RedirectResponse
    {
        Gate::authorize('update', $municipalImport);
        $data = $request->validate([
            'decision' => ['required', 'in:publish,reject'], 'reason' => ['required', 'string', 'max:2000'],
            'review_token' => ['required', 'string', 'size:64'],
        ]);
        $service->decide($municipalImport, $request->user(), $data['decision'], $data['reason'], $data['review_token']);

        return to_route('app.municipal-imports.show', $municipalImport);
    }

    public function enable(Request $request, DatasetSource $datasetSource): RedirectResponse
    {
        Gate::authorize('create', MunicipalImport::class);
        $request->validate(['terms_confirmed' => ['accepted'], 'reason' => ['required', 'string', 'max:2000']]);
        $datasetSource->publication_enabled = true;
        $datasetSource->terms_review = ['user_id' => $request->user()->id, 'at' => now()->toIso8601String(), 'reason' => $request->string('reason')->toString()];
        $datasetSource->save();

        return to_route('app.municipal-imports.index');
    }
}
