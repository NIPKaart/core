<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\App\StoreMunicipalImportRequest;
use App\Models\DatasetSource;
use App\Models\MunicipalImport;
use App\Services\MunicipalImportService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class MunicipalImportController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', MunicipalImport::class);

        $request->validate(['q' => ['nullable', 'string', 'max:200'], 'state' => ['nullable', 'in:all,pending,published,rejected']]);
        $query = trim($request->string('q')->toString());
        $state = $request->string('state', 'all')->toString() ?: 'all';

        return Inertia::render('backend/municipal-imports/index', [
            'datasets' => DatasetSource::orderBy('name')->get(),
            'imports' => MunicipalImport::with('datasetSource:id,name')
                ->when($state !== 'all', fn (Builder $builder) => $builder->where('state', $state))
                ->when($query !== '', fn (Builder $builder) => $builder->whereHas('datasetSource', fn (Builder $source) => $source->where('name', 'ilike', '%'.$query.'%')))
                ->latest('id')->paginate(20)->withQueryString(),
            'filters' => ['q' => $query, 'state' => $state],
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
        $request->validate([
            'q' => ['nullable', 'string', 'max:200'],
            'filter' => ['nullable', 'in:all,geometry,new,changed,unchanged,missing,conflict'],
        ]);
        $query = trim($request->string('q')->toString());
        $filter = $request->string('filter', 'all')->toString() ?: 'all';
        $rows = array_values(array_filter($review['rows'], function (array $row) use ($query, $filter): bool {
            $matchesFilter = match ($filter) {
                'all' => true,
                'geometry' => ! empty($row['geometry_derivation']),
                default => $row['status'] === $filter,
            };
            $searchable = implode(' ', [$row['external_id'], $row['after']['street'] ?? '', $row['before']['street'] ?? '']);

            return $matchesFilter && ($query === '' || mb_stripos($searchable, $query) !== false);
        }));
        $total = count($rows);
        $pages = max(1, (int) ceil($total / 25));
        $page = max(1, min((int) $request->query('page', 1), $pages));
        $review['rows'] = array_slice($rows, ($page - 1) * 25, 25);

        return Inertia::render('backend/municipal-imports/show', [
            'import' => $municipalImport, 'dataset' => $municipalImport->datasetSource,
            'municipalityName' => $municipalImport->datasetSource->municipality->name,
            'review' => $review, 'page' => $page, 'pages' => $pages,
            'total' => $total, 'filters' => ['q' => $query, 'filter' => $filter],
        ]);
    }

    public function update(Request $request, MunicipalImport $municipalImport, MunicipalImportService $service): RedirectResponse
    {
        Gate::authorize('update', $municipalImport);
        $data = $request->validate([
            'decision' => ['required', 'in:publish,reject'], 'reason' => ['required', 'string', 'max:2000'],
            'review_token' => ['required', 'string', 'size:64'],
            'geometry_reviewed' => ['sometimes', 'boolean'],
        ]);
        $service->decide($municipalImport, $request->user(), $data['decision'], $data['reason'], $data['review_token'], (bool) ($data['geometry_reviewed'] ?? false));

        return to_route('app.municipal-imports.show', $municipalImport);
    }

    public function enable(DatasetSource $datasetSource): RedirectResponse
    {
        Gate::authorize('create', MunicipalImport::class);
        $datasetSource->publication_enabled = true;
        $datasetSource->save();

        return to_route('app.municipal-imports.index');
    }
}
