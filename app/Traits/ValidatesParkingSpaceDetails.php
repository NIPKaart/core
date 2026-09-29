<?php

namespace App\Traits;

use App\Enums\ParkingOrientation;
use App\Enums\UnderSign;
use App\Models\ParkingSpace;
use Illuminate\Validation\Rule;

/**
 * Validation shared by contributors and moderators for the place-specific details of a ParkingSpace.
 *
 * Under-sign details are only accepted when a sub-sign is known to exist; otherwise they are cleared.
 */
trait ValidatesParkingSpaceDetails
{
    /**
     * Contributors must answer the under-sign question; moderators may leave it unknown for places submitted before it was asked.
     *
     * @return array<string, array<int, mixed>>
     */
    protected function parkingSpaceDetailRules(bool $requireUnderSign = true): array
    {
        $onlyWithUnderSign = 'exclude_unless:under_sign,'.UnderSign::YES->value;

        return [
            'orientation' => ['required', Rule::enum(ParkingOrientation::class)],
            'under_sign' => [$requireUnderSign ? 'required' : 'nullable', Rule::enum(UnderSign::class)],
            'under_sign_text' => [$onlyWithUnderSign, 'nullable', 'string', 'max:255'],
            'parking_hours' => [$onlyWithUnderSign, 'nullable', 'integer', 'min:0', 'max:24'],
            'parking_minutes' => [$onlyWithUnderSign, 'nullable', 'integer', 'min:0', 'max:59'],
            'restriction_days' => [$onlyWithUnderSign, 'nullable', 'array'],
            'restriction_days.*' => ['distinct', Rule::in(ParkingSpace::RESTRICTION_DAYS)],
            'restriction_starts_at' => [$onlyWithUnderSign, 'nullable', 'date_format:H:i', 'required_with:restriction_ends_at'],
            'restriction_ends_at' => [$onlyWithUnderSign, 'nullable', 'date_format:H:i', 'required_with:restriction_starts_at', 'different:restriction_starts_at'],
            'description' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * Map the validated details to ParkingSpace attributes, clearing under-sign details that do not apply.
     *
     * @return array<string, mixed>
     */
    public function parkingSpaceDetails(): array
    {
        $validated = $this->validated();
        $parkingTime = (int) ($validated['parking_hours'] ?? 0) * 60 + (int) ($validated['parking_minutes'] ?? 0);
        $days = array_values(array_intersect(ParkingSpace::RESTRICTION_DAYS, $validated['restriction_days'] ?? []));

        return [
            'orientation' => $validated['orientation'],
            'under_sign' => $validated['under_sign'] ?? null,
            'under_sign_text' => $validated['under_sign_text'] ?? null,
            'parking_time' => $parkingTime > 0 ? $parkingTime : null,
            'parking_disc' => $parkingTime > 0,
            'restriction_days' => $days !== [] ? $days : null,
            'restriction_starts_at' => $validated['restriction_starts_at'] ?? null,
            'restriction_ends_at' => $validated['restriction_ends_at'] ?? null,
            'description' => $validated['description'] ?? null,
        ];
    }
}
