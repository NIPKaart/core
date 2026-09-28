<?php

namespace App\Services;

use App\Models\DatasetSource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;

/**
 * One row per dataset source for the admin overview, with a single status that says what to do next.
 */
class SourceOverview
{
    /** Status order doubles as the default sort: sources that need an administrator come first. */
    public const array STATUSES = [
        'awaiting_approval', 'reapproval', 'intake_problem', 'overdue', 'awaiting_review',
        'awaiting_delivery', 'published', 'rejected',
    ];

    /** Statuses that need an administrator's action. */
    public const array ATTENTION = ['awaiting_approval', 'reapproval', 'intake_problem', 'overdue', 'awaiting_review'];

    public function __construct(private MunicipalProvenance $provenance) {}

    /** @return Collection<int, array<string, mixed>> */
    public function rows(): Collection
    {
        return DatasetSource::query()
            ->with([
                'municipality:id,name,code',
                'latestImport:dataset_imports.id,dataset_imports.dataset_source_id,retrieved_at,state',
                'latestDelivery:dataset_deliveries.id,dataset_deliveries.dataset_source_id,state,error_code,created_at',
            ])
            ->withCount([
                'municipalSpaces as visible_municipal_count' => fn (Builder $builder) => $builder->where('visibility', true),
                'offstreetSpaces as visible_offstreet_count' => fn (Builder $builder) => $builder->where('visibility', true),
                'deliveries as pending_deliveries_count' => fn (Builder $builder) => $builder->where('state', 'pending')->whereNull('error_code'),
            ])
            ->orderBy('name')->get()
            ->map(fn (DatasetSource $source): array => $this->row($source));
    }

    /** @return array<string, mixed> */
    private function row(DatasetSource $source): array
    {
        $latest = $source->latestImport;
        $deliveryStatus = $this->provenance->deliveryStatus($source);
        $needsReview = $latest?->state === 'pending' && (! $source->last_published_retrieved_at || $latest->retrieved_at->gt($source->last_published_retrieved_at));
        $intakeProblem = $source->latestDelivery && ($source->latestDelivery->error_code !== null || $source->latestDelivery->state === 'rejected');
        $status = match (true) {
            $source->approval_state === 'rejected' => 'rejected',
            $source->approval_state === 'pending' => $source->pending_description !== null ? 'reapproval' : 'awaiting_approval',
            $intakeProblem => 'intake_problem',
            $deliveryStatus === 'overdue' => 'overdue',
            $needsReview => 'awaiting_review',
            $source->last_published_retrieved_at === null => 'awaiting_delivery',
            default => 'published',
        };
        $area = $source->description['area'] ?? [];

        return [
            ...Arr::except($source->toArray(), ['visible_municipal_count', 'visible_offstreet_count', 'pending_deliveries_count']),
            'status' => $status,
            'country' => $area['country'] ?? null,
            'subdivision' => $area['subdivision'] ?? null,
            'municipality_name' => $source->municipality?->name ?? ($area['municipality']['name'] ?? null),
            'municipality_code' => $area['municipality']['code'] ?? null,
            'visible_locations_count' => $source->target_type === 'offstreet' ? $source->visible_offstreet_count : $source->visible_municipal_count,
            'needs_review' => $needsReview,
            'delivery_status' => $deliveryStatus,
            // Approved sources with pending deliveries are being processed; the page polls until they are done.
            'processing' => $source->approval_state === 'approved' && $source->pending_deliveries_count > 0,
        ];
    }
}
