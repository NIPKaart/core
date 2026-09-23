<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\App\StoreMunicipalImportRequest;
use App\Models\DatasetSource;
use App\Models\MunicipalImport;
use App\Services\MunicipalDeliveryService;
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

        $request->validate(['q' => ['nullable', 'string', 'max:200'], 'state' => ['nullable', 'in:all,pending,published,rejected,superseded'], 'dataset' => ['nullable', 'integer', 'exists:dataset_sources,id'], 'tab' => ['nullable', 'in:sources,deliveries']]);
        $query = trim($request->string('q')->toString());
        $state = $request->string('state', 'all')->toString() ?: 'all';

        return Inertia::render('backend/municipal-imports/index', [
            'datasets' => DatasetSource::where('target_type', 'municipal')
                ->with(['latestImport:municipal_imports.id,municipal_imports.dataset_source_id,retrieved_at,state', 'latestDelivery:municipal_deliveries.id,municipal_deliveries.dataset_source_id,state,error_code,created_at'])
                ->withCount(['municipalSpaces as visible_locations_count' => fn (Builder $builder) => $builder->where('visibility', true)])
                ->orderBy('name')->get()->map(function (DatasetSource $source): array {
                    $latest = $source->latestImport;

                    return [...$source->toArray(),
                        'needs_review' => $latest?->state === 'pending' && (! $source->last_published_retrieved_at || $latest->retrieved_at->gt($source->last_published_retrieved_at)),
                        'stale' => $latest !== null && $latest->retrieved_at->lt(now()->subHours(config('municipal-deliveries.sources.'.$source->code.'.max_age_hours', 48))),
                    ];
                }),
            'imports' => MunicipalImport::with('datasetSource:id,name,last_published_retrieved_at')
                ->when($request->filled('dataset'), fn (Builder $builder) => $builder->where('dataset_source_id', $request->integer('dataset')))
                ->when(in_array($state, ['published', 'rejected']), fn (Builder $builder) => $builder->where('state', $state))
                ->when(in_array($state, ['pending', 'superseded']), fn (Builder $builder) => $builder->where('state', 'pending')
                    ->whereHas('datasetSource', function (Builder $source) use ($state): void {
                        if ($state === 'superseded') {
                            $source->whereColumn('municipal_imports.retrieved_at', '<=', 'dataset_sources.last_published_retrieved_at');
                        } else {
                            $source->where(fn (Builder $query) => $query->whereNull('last_published_retrieved_at')
                                ->orWhereColumn('municipal_imports.retrieved_at', '>', 'dataset_sources.last_published_retrieved_at'));
                        }
                    }))
                ->when($query !== '', fn (Builder $builder) => $builder->whereHas('datasetSource', fn (Builder $source) => $source->where('name', 'ilike', '%'.$query.'%')))
                ->latest('id')->paginate(20)->withQueryString()->through(fn (MunicipalImport $import) => [...$import->toArray(), 'superseded' => $import->isSuperseded()]),
            'filters' => ['q' => $query, 'state' => $state, 'dataset' => $request->filled('dataset') ? $request->integer('dataset') : null, 'tab' => $request->string('tab', 'sources')->toString()],
        ]);
    }

    public function store(StoreMunicipalImportRequest $request, MunicipalDeliveryService $service): RedirectResponse
    {
        $import = $service->upload($request->file('file')->getContent(), $request->user());

        return to_route('app.municipal-imports.show', $import);
    }

    public function show(Request $request, MunicipalImport $municipalImport, MunicipalImportService $service): Response
    {
        Gate::authorize('view', $municipalImport);
        $review = $service->review($municipalImport);
        $request->validate([
            'q' => ['nullable', 'string', 'max:200'],
            'filter' => ['nullable', 'in:all,changes,geometry,new,changed,unchanged,missing,conflict'],
        ]);
        $query = trim($request->string('q')->toString());
        $defaultFilter = $municipalImport->state === 'pending' ? 'changes' : 'all';
        $filter = $request->string('filter', $defaultFilter)->toString() ?: $defaultFilter;
        $rows = array_values(array_filter($review['rows'], function (array $row) use ($query, $filter): bool {
            $matchesFilter = match ($filter) {
                'all' => true,
                'changes' => $row['status'] !== 'unchanged',
                'geometry' => $row['geometry_review_required'] ?? false,
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
            'import' => [...$municipalImport->toArray(), 'superseded' => $municipalImport->isSuperseded()], 'dataset' => $municipalImport->datasetSource,
            'municipalityName' => $municipalImport->datasetSource->municipality->name,
            'review' => $review, 'page' => $page, 'pages' => $pages,
            'total' => $total, 'filters' => ['q' => $query, 'filter' => $filter],
        ]);
    }

    public function update(Request $request, MunicipalImport $municipalImport, MunicipalImportService $service): RedirectResponse
    {
        Gate::authorize('update', $municipalImport);
        $data = $request->validate([
            'decision' => ['required', 'in:publish,reject'], 'reason' => ['nullable', 'string', 'max:2000'],
            'review_token' => ['required', 'string', 'size:64'],
            'geometry_reviewed' => ['sometimes', 'boolean'],
        ]);
        $service->decide($municipalImport, $request->user(), $data['decision'], $data['reason'] ?? null, $data['review_token'], (bool) ($data['geometry_reviewed'] ?? false));

        return to_route('app.municipal-imports.show', $municipalImport);
    }
}
