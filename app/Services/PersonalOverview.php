<?php

namespace App\Services;

use App\Enums\ParkingStatus;
use App\Enums\RuleLinkStatus;
use App\Http\Resources\DestinationResource;
use App\Models\Destination;
use App\Models\Favorite;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingRule;
use App\Models\ParkingSpace;
use App\Models\User;
use App\Support\GeoPoint;
use App\Support\ParkingResult;
use Illuminate\Support\Collection;

/**
 * The personal side of Mijn NIPKaart: where someone is going, the places they saved, what happened to their own
 * contributions and the official rules that apply where they park. Everything points to the map or an existing page.
 */
final class PersonalOverview
{
    public const int NEARBY_METRES = 300;

    private const int NEARBY_SHOWN = 3;

    /** Counting stops here; the overview says "50 or more" rather than running an unbounded count. */
    private const int NEARBY_COUNTED = 50;

    private const int FAVORITES_SHOWN = 3;

    private const int RULES_SHOWN = 4;

    private const int HISTORY_SHOWN = 3;

    public function __construct(private ParkingDiscovery $discovery, private UserActivity $activity) {}

    /**
     * @return array<string, mixed>
     */
    public function for(User $user, ?int $destinationId = null): array
    {
        $destinations = $user->destinations()->orderBy('label')->orderBy('id')->get();
        $selected = $destinations->firstWhere('id', $destinationId) ?? $destinations->first();
        $favorites = $user->favorites()->available()->latest('id')
            ->with(['favoritable' => fn ($morphTo) => $morphTo->morphWith([
                ParkingSpace::class => ['municipality:id,name'],
                ParkingMunicipal::class => ['municipality:id,name'],
                ParkingOffstreet::class => ['municipality:id,name'],
            ])])
            ->get()
            ->filter(fn (Favorite $favorite) => $favorite->favoritable !== null)
            ->values();

        return [
            'destinations' => $destinations->map(fn (Destination $destination) => (new DestinationResource($destination))->resolve())->all(),
            'destination_id' => $selected?->id,
            'nearby' => $selected ? $this->nearby($selected) : null,
            'garage' => $this->garage($favorites),
            'pending' => $this->pending($user),
            'published' => $user->parkingSpaces()->where('status', ParkingStatus::APPROVED)->count(),
            'favorites' => [
                'total' => $favorites->count(),
                'items' => $favorites->take(self::FAVORITES_SHOWN)->map(fn (Favorite $favorite) => $this->favorite($favorite))->all(),
            ],
            'rules' => $this->rules($favorites),
            'history' => $this->activity->contributions($user)->getCollection()
                ->reject(fn (array $contribution) => $contribution['status'] === 'pending')
                ->take(self::HISTORY_SHOWN)->values()->all(),
        ];
    }

    /**
     * Public parking within walking distance of a destination, nearest first, with the details that decide whether it fits.
     *
     * @return array{total: int, more: bool, items: list<array<string, mixed>>}
     */
    private function nearby(Destination $destination): array
    {
        $results = $this->discovery->withinRadius(new GeoPoint($destination->latitude, $destination->longitude), self::NEARBY_METRES, self::NEARBY_COUNTED);
        $shown = $results->take(self::NEARBY_SHOWN);
        $ids = fn (string $source) => $shown->where('source', $source)->pluck('id')->all();
        $spaces = ParkingSpace::whereKey($ids('community'))->get()->keyBy('id');
        $garages = ParkingOffstreet::whereKey($ids('offstreet'))->get()->keyBy('id');

        return [
            'total' => $results->count(),
            'more' => $results->count() >= self::NEARBY_COUNTED,
            'items' => $shown->map(function (ParkingResult $result) use ($spaces, $garages) {
                $space = $result->source === 'community' ? $spaces->get($result->id) : null;
                $garage = $result->source === 'offstreet' ? $garages->get($result->id)?->publicOccupancy() : null;

                return [
                    'key' => $result->key,
                    'source' => $result->source,
                    'title' => $result->title,
                    'distance_metres' => (int) round($result->distanceMetres ?? 0),
                    'parking_time' => $space?->parking_time,
                    'free_space' => $garage['free_space'] ?? null,
                    'map_url' => route('location-map', ['place' => $result->key, 'at' => sprintf('%.5f,%.5f', $result->latitude, $result->longitude)]),
                ];
            })->values()->all(),
        ];
    }

    /**
     * The most recently saved garage with its public occupancy, in the shape the garage overview uses.
     *
     * @param  Collection<int, Favorite>  $favorites
     * @return array<string, mixed>|null
     */
    private function garage(Collection $favorites): ?array
    {
        $garage = $favorites->first(fn (Favorite $favorite) => $favorite->favoritable instanceof ParkingOffstreet)?->favoritable;

        return $garage === null ? null : [
            ...$garage->overview(),
            'observed_at' => $garage->observed_at?->toIso8601String(),
            'municipality' => $garage->municipality?->name,
            'map_url' => UserActivity::mapUrl($garage),
        ];
    }

    /**
     * The latest own submission still waiting for a moderator.
     *
     * @return array<string, mixed>|null
     */
    private function pending(User $user): ?array
    {
        $space = $user->parkingSpaces()->where('status', ParkingStatus::PENDING)->with('municipality:id,name')->latest()->first();
        if ($space === null) {
            return null;
        }
        $editable = $user->can('updateSubmission', $space);

        return [
            'label' => collect([$space->street, $space->municipality?->name])->filter()->implode(', ') ?: null,
            'submitted_at' => $space->created_at->toIso8601String(),
            'edit_url' => $editable ? route('location-map.edit', ['parking_space' => $space->id]) : null,
            'withdraw_id' => $editable ? (string) $space->id : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function favorite(Favorite $favorite): array
    {
        $place = $favorite->favoritable;
        $space = $place instanceof ParkingSpace ? $place : null;

        return [
            'favorite_id' => $favorite->id,
            'source' => match (true) {
                $place instanceof ParkingSpace => 'community',
                $place instanceof ParkingMunicipal => 'municipal',
                default => 'offstreet',
            },
            'title' => $place instanceof ParkingOffstreet ? $place->name : $place->street,
            'municipality' => $place->municipality?->name,
            'parking_time' => $space?->parking_time,
            'restriction_days' => $space?->restriction_days ?: null,
            'restriction_starts_at' => $space?->restriction_starts_at,
            'restriction_ends_at' => $space?->restriction_ends_at,
            'map_url' => UserActivity::mapUrl($place),
        ];
    }

    /**
     * The official rules where the saved places lie: each municipality's own page, or the country's when it has none.
     * A link the last check could not open is left out; administrators see it on their workplace instead.
     *
     * @param  Collection<int, Favorite>  $favorites
     * @return list<array{id: int, name: ?string, nationwide: bool, url: string}>
     */
    private function rules(Collection $favorites): array
    {
        return $favorites
            ->map(fn (Favorite $favorite) => [$favorite->favoritable->country_id, $favorite->favoritable->municipality_id])
            ->unique(fn (array $area) => implode(':', $area))
            ->map(fn (array $area) => ParkingRule::applicableTo(...$area))
            ->filter(fn (?ParkingRule $rule) => $rule !== null && $rule->link_status !== RuleLinkStatus::BROKEN)
            ->unique('id')
            ->take(self::RULES_SHOWN)
            ->map(fn (ParkingRule $rule) => [
                'id' => $rule->id,
                'name' => $rule->nationwide ? $rule->country?->name : $rule->municipality?->name,
                'nationwide' => (bool) $rule->nationwide,
                'url' => $rule->url,
            ])
            ->values()
            ->all();
    }
}
