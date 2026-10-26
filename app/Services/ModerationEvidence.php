<?php

namespace App\Services;

use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingStatus;
use App\Models\ParkingMunicipal;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceConfirmation;
use App\Models\ParkingSpaceImprovement;
use App\Models\ParkingSpaceReview;
use App\Support\GeoPoint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * What a moderator can check about a place before deciding: its history on the map, how people confirmed it and
 * the municipal place nearest to it.
 *
 * Everything here is derived from records that already exist; none of it decides anything by itself.
 */
class ModerationEvidence
{
    /**
     * A municipal place within this distance is shown to the moderator as the nearest one.
     */
    public const int NEAREST_MUNICIPAL_METRES = 100;

    /**
     * The timeline shows at most this many events, the most recent ones.
     */
    private const int TIMELINE_LIMIT = 40;

    /**
     * The evidence for a published or reported place.
     *
     * @return array{timeline: list<array{kind: string, at: string}>, confirmed_total: int, last_confirmed_at: ?string, unavailable_since_confirmation: int, nearest_municipal: ?array<string, mixed>}
     */
    public function forPlace(ParkingSpace|ParkingMunicipal $place): array
    {
        $confirmations = $place->confirmations()->orderBy('confirmed_at')->get(['id', 'status', 'confirmed_at']);
        $confirmed = $confirmations->where('status', ParkingConfirmationStatus::CONFIRMED);
        $lastConfirmedAt = $confirmed->max('confirmed_at');

        return [
            'timeline' => $this->timeline($place, $confirmations),
            'confirmed_total' => $confirmed->count(),
            'last_confirmed_at' => $lastConfirmedAt ? Carbon::parse($lastConfirmedAt)->toIso8601String() : null,
            'unavailable_since_confirmation' => $confirmations
                ->where('status', ParkingConfirmationStatus::UNAVAILABLE)
                ->filter(fn (ParkingSpaceConfirmation $confirmation) => $lastConfirmedAt === null || $confirmation->confirmed_at->gt($lastConfirmedAt))
                ->count(),
            'nearest_municipal' => $place instanceof ParkingSpace
                ? $this->nearestMunicipal(new GeoPoint($place->latitude, $place->longitude))
                : null,
        ];
    }

    /**
     * The visible municipal place nearest to a location within NEAREST_MUNICIPAL_METRES, with what it describes.
     *
     * @return ?array{id: string, street: ?string, orientation: ?string, number: ?int, distance_metres: int}
     */
    public function nearestMunicipal(GeoPoint $location): ?array
    {
        $place = ParkingMunicipal::select('id', 'street', 'orientation', 'number')
            ->where('visibility', true)
            ->withinRadius($location, self::NEAREST_MUNICIPAL_METRES)
            ->nearestTo($location)
            ->first();

        return $place === null ? null : [
            'id' => $place->id,
            'street' => $place->street,
            'orientation' => $place->orientation?->value,
            'number' => $place->number,
            'distance_metres' => (int) round((float) $place->distance_metres),
        ];
    }

    /**
     * The place's events on the map, oldest first: added and approved, confirmed or reported by people, and the
     * improvements proposed for it.
     *
     * @param  Collection<int, ParkingSpaceConfirmation>  $confirmations
     * @return list<array{kind: string, at: string}>
     */
    private function timeline(ParkingSpace|ParkingMunicipal $place, Collection $confirmations): array
    {
        $events = $confirmations->map(fn (ParkingSpaceConfirmation $confirmation) => [
            'kind' => $confirmation->status->value,
            'at' => $confirmation->confirmed_at,
        ])->concat($place->reports()->get(['created_at'])->map(fn ($report) => ['kind' => 'reported', 'at' => $report->created_at]));

        if ($place instanceof ParkingSpace) {
            $events = $events
                ->push(['kind' => 'added', 'at' => $place->created_at])
                ->concat($place->reviews()->where('to_status', ParkingStatus::APPROVED)->get(['reviewed_at'])
                    ->map(fn (ParkingSpaceReview $review) => ['kind' => 'approved', 'at' => $review->reviewed_at]))
                ->concat($place->improvements()->get(['created_at', 'status', 'reviewed_at'])
                    ->map(fn (ParkingSpaceImprovement $improvement) => $improvement->status === ParkingStatus::APPROVED
                        ? ['kind' => 'improved', 'at' => $improvement->reviewed_at ?? $improvement->created_at]
                        : ['kind' => 'improvement', 'at' => $improvement->created_at]));
        }

        return $events
            ->filter(fn (array $event) => $event['at'] !== null)
            ->sortBy(fn (array $event) => Carbon::parse($event['at'])->getTimestamp())
            ->take(-self::TIMELINE_LIMIT)
            ->map(fn (array $event) => ['kind' => $event['kind'], 'at' => Carbon::parse($event['at'])->toIso8601String()])
            ->values()
            ->all();
    }
}
