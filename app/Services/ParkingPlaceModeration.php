<?php

namespace App\Services;

use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingStatus;
use App\Enums\RemovalAction;
use App\Enums\RemovalReason;
use App\Enums\ReportResolution;
use App\Models\ParkingMunicipal;
use App\Models\ParkingPlaceRemoval;
use App\Models\ParkingPlaceReport;
use App\Models\ParkingSpace;
use App\Models\User;
use App\Notifications\ParkingPlace\ReportResolved;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * Moderator decisions on places reported as no longer existing.
 *
 * Reports never change the map by themselves. A moderator either keeps the place, also when its existence stays
 * uncertain, or removes it: a community place is deleted with everything that only described it, and an imported
 * municipal place is hidden, which later imports respect.
 */
class ParkingPlaceModeration
{
    /**
     * Every place with open reports, most recently reported first, with the evidence a moderator needs.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function queue(): Collection
    {
        $community = $this->withEvidence(ParkingSpace::query(), 'parking_spaces', 'parking_space_id')
            ->with('municipality:id,name')
            ->get()
            ->map(fn (ParkingSpace $space) => $this->row('community', $space, $space->status === ParkingStatus::APPROVED));

        $municipal = $this->withEvidence(ParkingMunicipal::query(), 'parking_municipal_spaces', 'parking_municipal_id')
            ->with('municipality:id,name')
            ->get()
            ->map(fn (ParkingMunicipal $space) => $this->row('municipal', $space, $space->visibility));

        return $community->concat($municipal)->sortByDesc('last_reported_at')->values();
    }

    /**
     * The number of places awaiting a decision, for the moderation badge.
     */
    public function openPlaceCount(): int
    {
        return (int) ParkingPlaceReport::open()
            ->where(fn (Builder $reports) => $reports->whereNull('parking_space_id')->orWhereHas('parkingSpace'))
            ->selectRaw('count(distinct coalesce(parking_space_id::text, parking_municipal_id)) as places')
            ->value('places');
    }

    /**
     * Keep the place published and close its open reports.
     */
    public function keep(ParkingSpace|ParkingMunicipal $place, User $moderator): void
    {
        $reporters = DB::transaction(function () use ($place, $moderator) {
            $place = $this->lock($place);
            $reporters = $this->openReporters($place);
            $this->resolveOpenReports($place, $moderator, ReportResolution::KEPT);

            return $reporters;
        });

        Notification::send($reporters, new ReportResolved(
            placeLabel: $this->label($place) ?? '',
            removed: false,
            placeUrl: route('location-map', [
                'place' => ($place instanceof ParkingSpace ? 'community' : 'municipal').":{$place->getKey()}",
                'at' => sprintf('%.5f,%.5f', $place->latitude, $place->longitude),
            ]),
            actedByUserId: $moderator->id,
        ));
    }

    /**
     * Delete a community place or hide a municipal one, and record who decided it and why.
     */
    public function remove(ParkingSpace|ParkingMunicipal $place, User $moderator, RemovalReason $reason, ?string $note): ParkingPlaceRemoval
    {
        [$removal, $reporters] = DB::transaction(function () use ($place, $moderator, $reason, $note) {
            $place = $this->lock($place);
            $community = $place instanceof ParkingSpace;
            $reporters = $this->openReporters($place);

            $removal = ParkingPlaceRemoval::create([
                'source' => $community ? 'community' : 'municipal',
                'place_id' => $place->getKey(),
                'place_label' => $this->label($place),
                'action' => $community ? RemovalAction::DELETED : RemovalAction::HIDDEN,
                'reason' => $reason,
                'note' => filled($note) ? trim($note) : null,
                'open_reports' => $place->reports()->open()->count(),
                'removed_by' => $moderator->id,
                'removed_at' => now(),
            ]);

            if ($community) {
                // Favorites have no foreign key; confirmations, reviews and reports cascade with the place.
                $place->favoritedByUsers()->detach();
                $place->forceDelete();
            } else {
                $place->update(['visibility' => false]);
                $this->resolveOpenReports($place, $moderator, ReportResolution::REMOVED);
            }

            return [$removal, $reporters];
        });

        Notification::send($reporters, new ReportResolved(
            placeLabel: $removal->place_label ?? '',
            removed: true,
            placeUrl: null,
            reason: $reason->value,
            actedByUserId: $moderator->id,
        ));

        return $removal;
    }

    /**
     * The people with an open report on the place, who hear the moderator's decision.
     *
     * @return Collection<int, User>
     */
    private function openReporters(ParkingSpace|ParkingMunicipal $place): Collection
    {
        return $place->reports()->open()->with('user')->get()->pluck('user')->filter()->unique('id')->values();
    }

    /**
     * @template TModel of ParkingSpace|ParkingMunicipal
     *
     * @param  TModel  $place
     * @return TModel
     */
    private function lock(ParkingSpace|ParkingMunicipal $place): Model
    {
        return $place->newQuery()->whereKey($place->getKey())->lockForUpdate()->firstOrFail();
    }

    private function resolveOpenReports(ParkingSpace|ParkingMunicipal $place, User $moderator, ReportResolution $resolution): void
    {
        $place->reports()->open()->update([
            'resolved_at' => now(),
            'resolved_by' => $moderator->id,
            'resolution' => $resolution,
        ]);
    }

    /**
     * Load the open reports and the existence confirmations given since the first of them.
     *
     * @template TModel of ParkingSpace|ParkingMunicipal
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function withEvidence(Builder $query, string $table, string $foreignKey): Builder
    {
        $firstOpenReport = "(select min(r.created_at) from parking_place_reports r where r.{$foreignKey} = {$table}.id and r.resolved_at is null)";
        $confirmed = fn (Builder $confirmations) => $confirmations->where('status', ParkingConfirmationStatus::CONFIRMED);

        return $query
            ->whereHas('reports', fn (Builder $reports) => $reports->open())
            ->with(['reports' => fn ($reports) => $reports->open()->with('user:id,name')->oldest()])
            ->withCount(['confirmations as confirmations_since_report' => fn (Builder $confirmations) => $confirmed($confirmations)->whereRaw("confirmed_at >= {$firstOpenReport}")])
            ->withMax(['confirmations as last_confirmed_at' => $confirmed], 'confirmed_at');
    }

    /**
     * @return array<string, mixed>
     */
    private function row(string $source, ParkingSpace|ParkingMunicipal $place, bool $published): array
    {
        return [
            'key' => "{$source}:{$place->getKey()}",
            'source' => $source,
            'id' => $place->getKey(),
            'street' => $place->street,
            'municipality' => $place->municipality?->name,
            'municipality_id' => $place->municipality_id,
            'latitude' => $place->latitude,
            'longitude' => $place->longitude,
            'published' => $published,
            'first_reported_at' => $place->reports->first()->created_at,
            'last_reported_at' => $place->reports->last()->created_at,
            'reports' => $place->reports->map(fn (ParkingPlaceReport $report) => [
                'id' => $report->id,
                'reporter' => $report->user?->name,
                'reason' => $report->reason?->label(),
                'note' => $report->note,
                'reported_at' => $report->created_at,
            ])->values(),
            'confirmations_since_report' => $place->confirmations_since_report,
            'last_confirmed_at' => $place->last_confirmed_at ? Carbon::parse($place->last_confirmed_at)->toIso8601String() : null,
        ];
    }

    private function label(ParkingSpace|ParkingMunicipal $place): ?string
    {
        $label = collect([$place->street, $place->municipality?->name])->filter()->implode(', ');

        return $label !== '' ? $label : null;
    }
}
