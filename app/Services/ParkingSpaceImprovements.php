<?php

namespace App\Services;

use App\Enums\ImprovementRejectionReason;
use App\Enums\ParkingStatus;
use App\Models\Municipality;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceImprovement;
use App\Models\User;
use App\Notifications\CommunitySpace\ImprovementDecided;
use BackedEnum;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Proposed improvements to published community parking spaces, and the moderator's decision on them.
 *
 * A proposal holds only the values that differ from the space. A moved pin is resolved again and replaces the whole
 * location, so the country and municipality always match the coordinates. The public space changes only on approval.
 */
final class ParkingSpaceImprovements
{
    /** Changed together whenever the pin moves. */
    public const array LOCATION_FIELDS = ['latitude', 'longitude', 'country_id', 'province_id', 'municipality_id', 'city', 'suburb', 'neighbourhood', 'postcode', 'street', 'amenity'];

    public const array DETAIL_FIELDS = ['orientation', 'under_sign', 'under_sign_text', 'parking_time', 'parking_disc', 'restriction_days', 'restriction_starts_at', 'restriction_ends_at', 'description'];

    /** What a moderator sees as one change, and filters the queue by. */
    public const array CHANGE_GROUPS = [
        'location' => self::LOCATION_FIELDS,
        'orientation' => ['orientation'],
        'under_sign' => ['under_sign', 'under_sign_text', 'parking_time', 'parking_disc', 'restriction_days', 'restriction_starts_at', 'restriction_ends_at'],
        'description' => ['description'],
    ];

    /** Accounts younger than this many days are marked as new to moderators. */
    private const int NEW_ACCOUNT_DAYS = 7;

    public function __construct(private ParkingLocationResolver $resolver) {}

    /**
     * The values of the space that differ from the given pin and details.
     *
     * @param  array<string, mixed>  $details  place details as ValidatesParkingSpaceDetails maps them
     * @return array<string, mixed>
     *
     * @throws ValidationException when the moved pin does not resolve to a country and municipality, or nothing changes
     */
    public function changes(ParkingSpace $space, float $latitude, float $longitude, array $details): array
    {
        $current = $this->current($space);
        $proposed = array_map($this->normalize(...), $details);

        if ($this->normalize($latitude) !== $current['latitude'] || $this->normalize($longitude) !== $current['longitude']) {
            $location = $this->resolver->lookup($latitude, $longitude)
                ?? throw ValidationException::withMessages(['latitude' => __('parking_spaces.contribute.unresolved')]);

            $proposed = [
                ...$proposed,
                ...array_map($this->normalize(...), ['latitude' => $latitude, 'longitude' => $longitude, ...$this->resolver->attributesFor($location)]),
            ];
        }

        $changes = array_filter($proposed, fn (mixed $value, string $field) => $value !== $current[$field], ARRAY_FILTER_USE_BOTH);
        if ($changes === []) {
            throw ValidationException::withMessages(['general' => __('parking_spaces.improve.unchanged')]);
        }

        // A moved pin replaces the whole location, also the parts that happen to stay the same.
        return isset($changes['latitude']) || isset($changes['longitude'])
            ? [...$changes, ...array_intersect_key($proposed, array_flip(self::LOCATION_FIELDS))]
            : $changes;
    }

    /**
     * Submit a proposal for moderation; a user has one pending proposal per space.
     *
     * @param  array<string, mixed>  $changes
     */
    public function submit(ParkingSpace $space, User $user, array $changes): ParkingSpaceImprovement
    {
        return DB::transaction(function () use ($space, $user, $changes) {
            // Locking the space serializes submissions before checking for this user's pending proposal.
            $space = ParkingSpace::whereKey($space->getKey())->lockForUpdate()->firstOrFail();

            if ($space->improvements()->pending()->whereBelongsTo($user)->exists()) {
                throw ValidationException::withMessages(['general' => __('parking_spaces.improve.already_pending')]);
            }

            return $space->improvements()->create([
                'user_id' => $user->id,
                'status' => ParkingStatus::PENDING,
                'submitted' => $changes,
            ]);
        });
    }

    /**
     * Apply the moderator's version of the proposal to the space and record what it replaced.
     *
     * @param  array<string, mixed>  $changes
     */
    public function approve(ParkingSpaceImprovement $improvement, User $moderator, array $changes): void
    {
        $space = DB::transaction(function () use ($improvement, $moderator, $changes) {
            $space = ParkingSpace::whereKey($improvement->parking_space_id)->lockForUpdate()->firstOrFail();
            $previous = array_intersect_key($this->current($space), $changes);

            $space->update($changes);
            $improvement->update([
                'status' => ParkingStatus::APPROVED,
                'approved' => $changes,
                'previous' => $previous,
                'reviewed_by' => $moderator->id,
                'reviewed_at' => now(),
            ]);

            return $space;
        });

        $this->notifyProposer($improvement, $space, $moderator);
    }

    /**
     * Reject pending proposals and tell each proposer why; proposals decided meanwhile are left as they are.
     *
     * @param  list<int>  $ids
     * @return int the number of proposals rejected
     */
    public function reject(array $ids, User $moderator, ImprovementRejectionReason $reason, ?string $note): int
    {
        $improvements = DB::transaction(function () use ($ids, $moderator, $reason, $note) {
            $improvements = ParkingSpaceImprovement::pending()->whereKey($ids)->with(['parkingSpace', 'user'])->lockForUpdate()->get();

            ParkingSpaceImprovement::whereKey($improvements->modelKeys())->update([
                'status' => ParkingStatus::REJECTED,
                'reason' => $reason,
                'note' => filled($note) ? trim($note) : null,
                'reviewed_by' => $moderator->id,
                'reviewed_at' => now(),
                'updated_at' => now(),
            ]);

            return $improvements;
        });

        $improvements->each(fn (ParkingSpaceImprovement $improvement) => $this->notifyProposer($improvement, $improvement->parkingSpace, $moderator, $reason));

        return $improvements->count();
    }

    /**
     * Tell the proposer about the decision, with a link that reopens the space on the map.
     */
    private function notifyProposer(ParkingSpaceImprovement $improvement, ParkingSpace $space, User $moderator, ?ImprovementRejectionReason $reason = null): void
    {
        $improvement->user?->notify(new ImprovementDecided(
            spaceId: $space->id,
            spaceLabel: $space->street ?: "Space #{$space->id}",
            approved: $reason === null,
            placeUrl: route('location-map', [
                'place' => "community:{$space->id}",
                'at' => sprintf('%.5f,%.5f', $space->latitude, $space->longitude),
            ]),
            reason: $reason?->value,
            actedByUserId: $moderator->id,
        ));
    }

    /**
     * One page of open proposals, oldest first, or of decided ones, most recent first.
     *
     * @param  array{search?: ?string, municipality_ids?: list<int>, changes?: list<string>, decisions?: list<string>}  $filters
     */
    public function list(bool $open, array $filters, int $perPage = 25): LengthAwarePaginator
    {
        $query = ParkingSpaceImprovement::query()
            ->with(['parkingSpace:id,street,latitude,longitude,municipality_id', 'parkingSpace.municipality:id,name', 'reviewer:id,name'])
            ->with(['user' => fn ($user) => $this->withTrackRecord($user)]);

        if ($open) {
            $query->pending()->oldest()->orderBy('id')
                ->selectRaw('parking_space_improvements.*, (select count(*) from parking_space_improvements other where other.parking_space_id = parking_space_improvements.parking_space_id and other.status = ?) as pending_for_space', [ParkingStatus::PENDING->value])
                ->selectRaw('exists (select 1 from parking_place_reports report where report.parking_space_id = parking_space_improvements.parking_space_id and report.resolved_at is null) as reported');
        } else {
            $decisions = array_intersect($filters['decisions'] ?? [], [ParkingStatus::APPROVED->value, ParkingStatus::REJECTED->value]);
            $query->whereIn('status', $decisions !== [] ? $decisions : [ParkingStatus::APPROVED, ParkingStatus::REJECTED])
                ->latest('reviewed_at')->orderByDesc('id');
        }

        $this->filter($query, $filters);

        $page = $query->paginate($perPage)->withQueryString();
        $municipalities = $this->municipalityNames($page->getCollection());

        $page->through(fn (ParkingSpaceImprovement $improvement) => $open
            ? $this->openRow($improvement, $municipalities)
            : $this->decidedRow($improvement, $municipalities));

        return $page;
    }

    /**
     * Everything a moderator needs to decide on one proposal.
     *
     * @return array<string, mixed>
     */
    public function review(ParkingSpaceImprovement $improvement): array
    {
        $improvement->load(['parkingSpace.municipality:id,name', 'user' => fn ($user) => $this->withTrackRecord($user)]);
        $space = $improvement->parkingSpace;
        $municipalities = $this->municipalityNames(collect([$improvement]));

        return [
            'id' => $improvement->id,
            'submitted_at' => $improvement->created_at,
            'proposer' => $this->proposer($improvement),
            'space' => [
                'id' => $space->id,
                'street' => $space->street,
                'municipality' => $space->municipality?->name,
                'published' => $space->status === ParkingStatus::APPROVED,
                'confirmations' => $space->publicConfirmations(null)['confirmations_count']['confirmed'],
            ],
            'current' => $this->withMunicipalityName($this->current($space), $municipalities),
            'submitted' => $this->withMunicipalityName($improvement->submitted, $municipalities),
            'changes' => $this->changeGroups($improvement->submitted),
            'distance_metres' => $this->distance($this->current($space), $improvement->submitted),
        ];
    }

    /**
     * Where this proposal sits in the open queue, and its neighbours there.
     *
     * @return array{index: int, total: int, previous: ?int, next: ?int}
     */
    public function position(ParkingSpaceImprovement $improvement): array
    {
        $before = fn (Builder $query) => $query->where('created_at', '<', $improvement->created_at)
            ->orWhere(fn (Builder $query) => $query->where('created_at', $improvement->created_at)->where('id', '<', $improvement->id));
        $after = fn (Builder $query) => $query->where('created_at', '>', $improvement->created_at)
            ->orWhere(fn (Builder $query) => $query->where('created_at', $improvement->created_at)->where('id', '>', $improvement->id));

        return [
            'index' => ParkingSpaceImprovement::pending()->where($before)->count() + 1,
            'total' => ParkingSpaceImprovement::pending()->count(),
            'previous' => ParkingSpaceImprovement::pending()->where($before)->latest()->orderByDesc('id')->value('id'),
            'next' => ParkingSpaceImprovement::pending()->where($after)->oldest()->orderBy('id')->value('id'),
        ];
    }

    /**
     * The open proposal to review after this one: the next in the queue, else the oldest one left.
     */
    public function nextAfter(ParkingSpaceImprovement $improvement): ?int
    {
        return $this->position($improvement)['next']
            ?? ParkingSpaceImprovement::pending()->whereKeyNot($improvement->id)->oldest()->orderBy('id')->value('id');
    }

    public function pendingCount(): int
    {
        return ParkingSpaceImprovement::pending()->count();
    }

    /**
     * The space's improvable values in the same form as a proposal.
     *
     * @return array<string, mixed>
     */
    public function current(ParkingSpace $space): array
    {
        $values = [];
        foreach ([...self::LOCATION_FIELDS, ...self::DETAIL_FIELDS] as $field) {
            $values[$field] = $this->normalize($space->getAttribute($field));
        }

        return $values;
    }

    /**
     * The change groups a set of values touches, in display order.
     *
     * @param  array<string, mixed>  $values
     * @return list<string>
     */
    public function changeGroups(array $values): array
    {
        return array_keys(array_filter(self::CHANGE_GROUPS, fn (array $fields) => array_intersect_key($values, array_flip($fields)) !== []));
    }

    /**
     * @param  Builder<ParkingSpaceImprovement>  $query
     * @param  array{search?: ?string, municipality_ids?: list<int>, changes?: list<string>}  $filters
     */
    private function filter(Builder $query, array $filters): void
    {
        if (filled($filters['search'] ?? null)) {
            $term = '%'.addcslashes(trim($filters['search']), '%_\\').'%';
            $query->where(fn (Builder $query) => $query
                ->whereHas('parkingSpace', fn (Builder $space) => $space->whereLike('street', $term)
                    ->orWhereHas('municipality', fn (Builder $municipality) => $municipality->whereLike('name', $term)))
                ->orWhereHas('user', fn (Builder $user) => $user->whereLike('name', $term)));
        }

        if (($filters['municipality_ids'] ?? []) !== []) {
            $query->whereHas('parkingSpace', fn (Builder $space) => $space->whereIn('municipality_id', $filters['municipality_ids']));
        }

        $groups = array_intersect_key(self::CHANGE_GROUPS, array_flip($filters['changes'] ?? []));
        if ($groups !== []) {
            $query->where(function (Builder $query) use ($groups) {
                foreach (array_merge(...array_values($groups)) as $field) {
                    $query->orWhereJsonContainsKey("submitted->{$field}");
                }
            });
        }
    }

    /**
     * @param  Collection<int, int|string>  $municipalities
     * @return array<string, mixed>
     */
    private function openRow(ParkingSpaceImprovement $improvement, Collection $municipalities): array
    {
        $space = $improvement->parkingSpace;
        $submitted = $improvement->submitted;

        return [
            'id' => $improvement->id,
            'space' => ['id' => $space->id, 'street' => $space->street, 'municipality' => $space->municipality?->name],
            'changes' => $this->changeGroups($submitted),
            'distance_metres' => $this->distance(['latitude' => $space->latitude, 'longitude' => $space->longitude], $submitted),
            'flags' => [
                'other_municipality' => isset($submitted['municipality_id']) && $submitted['municipality_id'] !== $space->municipality_id
                    ? $municipalities[$submitted['municipality_id']] ?? true
                    : null,
                'competing' => (int) $improvement->pending_for_space > 1,
                'reported' => (bool) $improvement->reported,
            ],
            'proposer' => $this->proposer($improvement),
            'submitted_at' => $improvement->created_at,
        ];
    }

    /**
     * @param  Collection<int, int|string>  $municipalities
     * @return array<string, mixed>
     */
    private function decidedRow(ParkingSpaceImprovement $improvement, Collection $municipalities): array
    {
        $applied = $improvement->approved ?? [];
        $fields = array_keys($applied !== [] ? $applied : $improvement->submitted);

        return [
            'id' => $improvement->id,
            'space' => [
                'id' => $improvement->parking_space_id,
                'street' => $improvement->parkingSpace?->street,
                'municipality' => $improvement->parkingSpace?->municipality?->name,
            ],
            'changes' => $this->changeGroups($applied !== [] ? $applied : $improvement->submitted),
            'status' => $improvement->status->value,
            'corrected' => $applied !== [] && $applied != $improvement->submitted,
            'reason' => $improvement->reason?->label(),
            'note' => $improvement->note,
            'proposer' => $improvement->user?->name,
            'submitted_at' => $improvement->created_at,
            'reviewer' => $improvement->reviewer?->name,
            'reviewed_at' => $improvement->reviewed_at,
            'previous' => $this->withMunicipalityName($improvement->previous ?? [], $municipalities),
            'submitted' => $this->withMunicipalityName($improvement->submitted, $municipalities),
            'applied' => $this->withMunicipalityName($applied, $municipalities),
            'fields' => $fields,
        ];
    }

    /**
     * @return array{name: ?string, approved: int, rejected: int, is_new: bool}
     */
    private function proposer(ParkingSpaceImprovement $improvement): array
    {
        $user = $improvement->user;

        return [
            'name' => $user?->name,
            'approved' => (int) ($user->approved_improvements ?? 0),
            'rejected' => (int) ($user->rejected_improvements ?? 0),
            'is_new' => $user !== null && $user->created_at->gt(now()->subDays(self::NEW_ACCOUNT_DAYS)),
        ];
    }

    /**
     * @param  Builder<User>|Relation<User, ParkingSpaceImprovement, *>  $user
     */
    private function withTrackRecord(mixed $user): mixed
    {
        return $user->select('id', 'name', 'created_at')->withCount([
            'parkingSpaceImprovements as approved_improvements' => fn (Builder $query) => $query->where('status', ParkingStatus::APPROVED),
            'parkingSpaceImprovements as rejected_improvements' => fn (Builder $query) => $query->where('status', ParkingStatus::REJECTED),
        ]);
    }

    /**
     * Names of the municipalities proposals move spaces to, by id.
     *
     * @param  Collection<int, ParkingSpaceImprovement>  $improvements
     * @return Collection<int, string>
     */
    private function municipalityNames(Collection $improvements): Collection
    {
        $ids = $improvements
            ->flatMap(fn (ParkingSpaceImprovement $improvement) => [
                $improvement->submitted['municipality_id'] ?? null,
                $improvement->approved['municipality_id'] ?? null,
                $improvement->previous['municipality_id'] ?? null,
            ])
            ->filter()
            ->unique();

        return $ids->isEmpty() ? collect() : Municipality::whereIn('id', $ids)->pluck('name', 'id');
    }

    /**
     * @param  array<string, mixed>  $values
     * @param  Collection<int, string>  $municipalities
     * @return array<string, mixed>
     */
    private function withMunicipalityName(array $values, Collection $municipalities): array
    {
        return isset($values['municipality_id'])
            ? [...$values, 'municipality' => $municipalities[$values['municipality_id']] ?? null]
            : $values;
    }

    /**
     * How far a proposal moves the pin, in whole metres, or null when it keeps the location.
     *
     * @param  array<string, mixed>  $from
     * @param  array<string, mixed>  $to
     */
    private function distance(array $from, array $to): ?int
    {
        if (! isset($to['latitude'], $to['longitude'])) {
            return null;
        }

        $radians = fn (float $degrees) => deg2rad($degrees);
        $latitudeDelta = $radians($to['latitude'] - $from['latitude']);
        $longitudeDelta = $radians($to['longitude'] - $from['longitude']);
        $a = sin($latitudeDelta / 2) ** 2 + cos($radians($from['latitude'])) * cos($radians($to['latitude'])) * sin($longitudeDelta / 2) ** 2;

        return (int) round(6371000 * 2 * atan2(sqrt($a), sqrt(1 - $a)));
    }

    /**
     * Compare and store values alike: enums by value, coordinates at their stored precision, times without seconds.
     */
    private function normalize(mixed $value): mixed
    {
        return match (true) {
            $value instanceof BackedEnum => $value->value,
            is_float($value) => round($value, 7),
            is_string($value) && preg_match('/^\d{2}:\d{2}:\d{2}$/', $value) === 1 => substr($value, 0, 5),
            $value === '', $value === [] => null,
            default => $value,
        };
    }
}
