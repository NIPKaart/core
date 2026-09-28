<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\App\StoreDatasetImportRequest;
use App\Models\DatasetImport;
use App\Services\DatasetDeliveryService;
use App\Services\DatasetImports;
use App\Services\MunicipalProvenance;
use App\Services\SourceOverview;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class DatasetImportController extends Controller
{
    public function index(Request $request, SourceOverview $overview): Response
    {
        Gate::authorize('viewAny', DatasetImport::class);

        $request->validate([
            'q' => ['nullable', 'string', 'max:200'], 'state' => ['nullable', 'in:all,pending,published,rejected,superseded'],
            'dataset' => ['nullable', 'integer', 'exists:dataset_sources,id'], 'tab' => ['nullable', 'in:sources,deliveries'],
            'search' => ['nullable', 'string', 'max:200'], 'status' => ['nullable', Rule::in(['all', 'attention', ...SourceOverview::STATUSES])],
            'type' => ['nullable', 'in:all,municipal,offstreet'], 'country' => ['nullable', 'string', 'size:2'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $query = trim($request->string('q')->toString());
        $state = $request->string('state', 'all')->toString() ?: 'all';
        $sourceFilters = [
            'search' => trim($request->string('search')->toString()),
            'status' => $request->string('status', 'all')->toString() ?: 'all',
            'type' => $request->string('type', 'all')->toString() ?: 'all',
            'country' => $request->filled('country') ? strtoupper($request->string('country')->toString()) : null,
        ];
        $rows = $overview->rows();

        return Inertia::render('backend/imports/index', [
            'datasets' => $rows->map(fn (array $row) => Arr::only($row, ['id', 'name']))->values(),
            'sources' => $this->paginateSources($request, $rows, $sourceFilters),
            'summary' => [
                ...collect(SourceOverview::STATUSES)->mapWithKeys(fn (string $status) => [$status => $rows->where('status', $status)->count()])->all(),
                'total' => $rows->count(),
                'processing' => $rows->contains('processing', true),
            ],
            'countries' => $rows->pluck('country')->filter()->unique()->sort()->values(),
            'imports' => DatasetImport::with('datasetSource:id,name,target_type,last_published_retrieved_at')
                ->when($request->filled('dataset'), fn (Builder $builder) => $builder->where('dataset_source_id', $request->integer('dataset')))
                ->when(in_array($state, ['published', 'rejected']), fn (Builder $builder) => $builder->where('state', $state))
                ->when(in_array($state, ['pending', 'superseded']), fn (Builder $builder) => $builder->where('state', 'pending')
                    ->whereHas('datasetSource', function (Builder $source) use ($state): void {
                        if ($state === 'superseded') {
                            $source->whereColumn('dataset_imports.retrieved_at', '<=', 'dataset_sources.last_published_retrieved_at');
                        } else {
                            $source->where(fn (Builder $query) => $query->whereNull('last_published_retrieved_at')
                                ->orWhereColumn('dataset_imports.retrieved_at', '>', 'dataset_sources.last_published_retrieved_at'));
                        }
                    }))
                ->when($query !== '', fn (Builder $builder) => $builder->whereHas('datasetSource', fn (Builder $source) => $source->where('name', 'ilike', '%'.$query.'%')))
                ->latest('id')->paginate(20)->withQueryString()->through(fn (DatasetImport $import) => [...$import->toArray(), 'superseded' => $import->isSuperseded()]),
            'filters' => [
                'q' => $query, 'state' => $state, 'dataset' => $request->filled('dataset') ? $request->integer('dataset') : null,
                'tab' => $request->string('tab', 'sources')->toString(), ...$sourceFilters,
            ],
        ]);
    }

    /**
     * Filters and pages the overview; the default order puts sources that need an administrator first.
     *
     * @param  Collection<int, array<string, mixed>>  $rows
     * @param  array{search: string, status: string, type: string, country: ?string}  $filters
     */
    private function paginateSources(Request $request, Collection $rows, array $filters): LengthAwarePaginator
    {
        $needle = mb_strtolower($filters['search']);
        $filtered = $rows
            ->when($needle !== '', fn (Collection $rows) => $rows->filter(fn (array $row) => str_contains(mb_strtolower(implode(' ', [
                $row['name'], $row['code'], $row['municipality_name'], $row['municipality_code'], $row['publisher'],
            ])), $needle)))
            ->when($filters['status'] === 'attention', fn (Collection $rows) => $rows->whereIn('status', SourceOverview::ATTENTION))
            ->when(! in_array($filters['status'], ['all', 'attention'], true), fn (Collection $rows) => $rows->where('status', $filters['status']))
            ->when($filters['type'] !== 'all', fn (Collection $rows) => $rows->where('target_type', $filters['type']))
            ->when($filters['country'] !== null, fn (Collection $rows) => $rows->where('country', $filters['country']))
            ->sortBy([fn (array $a, array $b) => array_search($a['status'], SourceOverview::STATUSES) <=> array_search($b['status'], SourceOverview::STATUSES), ['name', 'asc']])
            ->values();
        $perPage = 25;
        $page = max(1, min((int) $request->query('page', 1), (int) max(1, ceil($filtered->count() / $perPage))));

        return (new LengthAwarePaginator($filtered->forPage($page, $perPage)->values(), $filtered->count(), $perPage, $page, [
            'path' => $request->url(), 'pageName' => 'page',
        ]))->withQueryString();
    }

    public function store(StoreDatasetImportRequest $request, DatasetDeliveryService $service): RedirectResponse
    {
        $import = $service->upload($request->file('file')->getContent(), $request->user());

        return to_route('app.imports.show', $import);
    }

    public function show(Request $request, DatasetImport $datasetImport, DatasetImports $imports, MunicipalProvenance $provenance): Response
    {
        Gate::authorize('view', $datasetImport);
        $review = $imports->forSource($datasetImport->datasetSource)->review($datasetImport);
        $request->validate([
            'q' => ['nullable', 'string', 'max:200'],
            'filter' => ['nullable', 'in:all,changes,geometry,new,changed,unchanged,missing,conflict'],
        ]);
        $query = trim($request->string('q')->toString());
        $defaultFilter = $datasetImport->state === 'pending' ? 'changes' : 'all';
        $filter = $request->string('filter', $defaultFilter)->toString() ?: $defaultFilter;
        $rows = array_values(array_filter($review['rows'], function (array $row) use ($query, $filter): bool {
            $matchesFilter = match ($filter) {
                'all' => true,
                'changes' => $row['status'] !== 'unchanged',
                'geometry' => $row['geometry_review_required'] ?? false,
                default => $row['status'] === $filter,
            };
            $searchable = implode(' ', [$row['external_id'], $row['after']['street'] ?? $row['after']['name'] ?? '', $row['before']['street'] ?? $row['before']['name'] ?? '']);

            return $matchesFilter && ($query === '' || mb_stripos($searchable, $query) !== false);
        }));
        $total = count($rows);
        $pages = max(1, (int) ceil($total / 25));
        $page = max(1, min((int) $request->query('page', 1), $pages));
        $review['rows'] = array_slice($rows, ($page - 1) * 25, 25);

        return Inertia::render('backend/imports/show', [
            'import' => [...$datasetImport->toArray(), 'superseded' => $datasetImport->isSuperseded()], 'dataset' => $datasetImport->datasetSource,
            'municipalityName' => $datasetImport->datasetSource->municipality->name,
            'times' => $provenance->importTimes($datasetImport),
            'review' => $review, 'page' => $page, 'pages' => $pages,
            'total' => $total, 'filters' => ['q' => $query, 'filter' => $filter],
        ]);
    }

    public function update(Request $request, DatasetImport $datasetImport, DatasetImports $imports): RedirectResponse
    {
        Gate::authorize('update', $datasetImport);
        $data = $request->validate([
            'decision' => ['required', 'in:publish,reject'], 'reason' => ['nullable', 'string', 'max:2000'],
            'review_token' => ['required', 'string', 'size:64'],
            'geometry_reviewed' => ['sometimes', 'boolean'],
        ]);
        $imports->forSource($datasetImport->datasetSource)->decide($datasetImport, $request->user(), $data['decision'], $data['reason'] ?? null, $data['review_token'], (bool) ($data['geometry_reviewed'] ?? false));

        return to_route('app.imports.show', $datasetImport);
    }
}
