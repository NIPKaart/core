<?php

namespace App\Services;

use App\Enums\ParkingStatus;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingPlaceReport;
use App\Models\ParkingSpace;
use App\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Current own contributions, newest first, without a separate activity archive.
 */
final class UserActivity
{
    /**
     * One current status per own contribution; notifications stay in the existing inbox.
     *
     * @return LengthAwarePaginator<int, array<string, mixed>>
     */
    public function contributions(User $user, int $page = 1): LengthAwarePaginator
    {
        $submissions = $user->parkingSpaces()->selectRaw("id::text as id, 'submission' as kind, updated_at as at")->toBase();
        $improvements = $user->parkingSpaceImprovements()->selectRaw("id::text as id, 'improvement' as kind, COALESCE(reviewed_at, created_at) as at")->toBase();
        $reports = ParkingPlaceReport::whereBelongsTo($user)->selectRaw("id::text as id, 'report' as kind, COALESCE(resolved_at, created_at) as at")->toBase();
        $rows = DB::query()->fromSub($submissions->unionAll($improvements)->unionAll($reports), 'contributions')
            ->orderByDesc('at')->orderBy('kind')->orderBy('id')->paginate(15, ['*'], 'contributions_page', $page);
        $ids = $rows->getCollection()->groupBy('kind');
        $spaces = $user->parkingSpaces()->with(['municipality:id,name', 'latestReview'])
            ->whereIn('id', $ids->get('submission', collect())->pluck('id'))->get()->keyBy('id');
        $proposals = $user->parkingSpaceImprovements()->with('parkingSpace.municipality:id,name')
            ->whereIn('id', $ids->get('improvement', collect())->pluck('id'))->get()->keyBy('id');
        $placeReports = ParkingPlaceReport::whereBelongsTo($user)->with(['parkingSpace.municipality:id,name', 'parkingMunicipal.municipality:id,name'])
            ->whereIn('id', $ids->get('report', collect())->pluck('id'))->get()->keyBy('id');

        return $rows->appends(['section' => 'contributions'])->through(function (object $row) use ($spaces, $proposals, $placeReports, $user): array {
            $entry = match ($row->kind) {
                'submission' => $spaces->get($row->id),
                'improvement' => $proposals->get($row->id),
                'report' => $placeReports->get($row->id),
            };
            $place = match ($row->kind) {
                'submission' => $entry,
                'improvement' => $entry?->parkingSpace,
                'report' => $entry?->parkingSpace ?? $entry?->parkingMunicipal,
            };
            $status = $row->kind === 'report' ? ($entry?->resolution?->value ?? 'pending') : ($entry?->status?->value ?? 'unavailable');
            $reason = match ($row->kind) {
                'submission' => $status === 'rejected' ? $entry?->latestReview?->reason?->label() : null,
                'improvement' => $status === 'rejected' ? $entry?->reason?->label() : null,
                default => null,
            };
            $public = $place !== null && ! ($place instanceof ParkingSpace && $place->trashed()) && self::isPublic($place);
            $editable = $row->kind === 'submission' && $entry !== null && ! $entry->trashed() && $user->can('updateSubmission', $entry);

            return [
                'key' => "{$row->kind}:{$row->id}", 'kind' => $row->kind,
                'at' => Carbon::parse($row->at)->toIso8601String(),
                'label' => $place !== null && ($public || $row->kind === 'submission') ? $this->label($place->street, $place->municipality?->name) : null,
                'status' => $status, 'reason' => $reason,
                'url' => $editable ? route('location-map.edit', ['parking_space' => $entry->id]) : ($public ? self::mapUrl($place) : null),
                'action' => $editable ? 'edit' : ($public ? 'map' : null),
                'withdraw_id' => $editable ? (string) $entry->id : null,
            ];
        });
    }

    /**
     * Whether the public map shows the place; hidden places are referred to without their name or location.
     */
    public static function isPublic(ParkingSpace|ParkingMunicipal|ParkingOffstreet $place): bool
    {
        return $place instanceof ParkingSpace ? $place->status === ParkingStatus::APPROVED : (bool) $place->visibility;
    }

    /**
     * Where a place is on the public map.
     */
    public static function mapUrl(ParkingSpace|ParkingMunicipal|ParkingOffstreet $place): string
    {
        $source = match (true) {
            $place instanceof ParkingSpace => 'community',
            $place instanceof ParkingMunicipal => 'municipal',
            default => 'offstreet',
        };

        return route('location-map', [
            'place' => "{$source}:{$place->getKey()}",
            'at' => sprintf('%.5f,%.5f', $place->latitude, $place->longitude),
        ]);
    }

    private function label(?string $street, ?string $place): ?string
    {
        $label = collect([$street, $place])->filter()->implode(', ');

        return $label !== '' ? $label : null;
    }
}
