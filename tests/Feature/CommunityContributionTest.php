<?php

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Enums\RejectionReason;
use App\Enums\UnderSign;
use App\Enums\UserRole;
use App\Models\Municipality;
use App\Models\ParkingSpace;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Notification::fake();
});

/**
 * @param  array<string, mixed>  $details
 * @return array<string, mixed>
 */
function submission(array $details = []): array
{
    $municipality = Municipality::factory()->create();

    return [
        'latitude' => 52.37,
        'longitude' => 4.9,
        'orientation' => ParkingOrientation::PARALLEL->value,
        'under_sign' => UnderSign::NO->value,
        'nominatim' => json_encode([
            'country_code' => $municipality->country->code,
            'state' => $municipality->province->name,
            'city' => $municipality->name,
            'road' => 'Teststraat',
        ]),
        ...$details,
    ];
}

/**
 * @return array<string, mixed>
 */
function moderationPayload(ParkingSpace $space, array $overrides = []): array
{
    return [
        'country_id' => $space->country_id,
        'province_id' => $space->province_id,
        'municipality_id' => $space->municipality_id,
        'postcode' => '1000 AA',
        'street' => 'Teststraat',
        'latitude' => 52.37,
        'longitude' => 4.9,
        'orientation' => ParkingOrientation::PARALLEL->value,
        'under_sign' => UnderSign::NO->value,
        'status' => $space->status->value,
        ...$overrides,
    ];
}

describe('submitting a place', function () {
    test('stores the literal under-sign text and its structured interpretation', function () {
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('location-map.store'), submission([
            'under_sign' => UnderSign::YES->value,
            'under_sign_text' => 'Ma-vr 09-18 h, max. 2 uur',
            'parking_hours' => 2,
            'restriction_days' => ['fri', 'mon'],
            'restriction_starts_at' => '09:00',
            'restriction_ends_at' => '18:00',
            'description' => 'Next to the pharmacy entrance.',
        ]))->assertSessionHasNoErrors();

        expect($user->parkingSpaces()->sole())
            ->status->toBe(ParkingStatus::PENDING)
            ->under_sign->toBe(UnderSign::YES)
            ->under_sign_text->toBe('Ma-vr 09-18 h, max. 2 uur')
            ->parking_time->toBe(120)
            ->parking_disc->toBeTrue()
            ->restriction_days->toBe(['mon', 'fri'])
            ->restriction_starts_at->toStartWith('09:00')
            ->description->toBe('Next to the pharmacy entrance.');
    });

    test('a sub-sign is optional to describe; knowing it exists is enough', function () {
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('location-map.store'), submission(['under_sign' => UnderSign::YES->value]))
            ->assertSessionHasNoErrors();

        expect($user->parkingSpaces()->sole())
            ->under_sign->toBe(UnderSign::YES)
            ->parking_time->toBeNull()
            ->restriction_days->toBeNull();
    });

    test('details sent without a sub-sign are discarded', function () {
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('location-map.store'), submission([
            'under_sign' => UnderSign::NO->value,
            'under_sign_text' => 'Leftover text',
            'parking_hours' => 2,
            'restriction_days' => ['mon'],
        ]))->assertSessionHasNoErrors();

        expect($user->parkingSpaces()->sole())
            ->under_sign_text->toBeNull()
            ->parking_time->toBeNull()
            ->parking_disc->toBeFalse()
            ->restriction_days->toBeNull();
    });

    test('rejects incomplete or invalid details', function (array $details, string $field) {
        $this->actingAs(User::factory()->create())
            ->post(route('location-map.store'), submission($details))
            ->assertSessionHasErrors($field);

        expect(ParkingSpace::count())->toBe(0);
    })->with([
        'missing orientation' => [['orientation' => null], 'orientation'],
        'unsupported orientation' => [['orientation' => 'diagonal'], 'orientation'],
        'unanswered sub-sign' => [['under_sign' => null], 'under_sign'],
        'unknown is not an answer' => [['under_sign' => 'unknown'], 'under_sign'],
        'start without end' => [['under_sign' => 'yes', 'restriction_starts_at' => '09:00'], 'restriction_ends_at'],
        'unknown day' => [['under_sign' => 'yes', 'restriction_days' => ['someday']], 'restriction_days.0'],
        'note too long' => [['description' => str_repeat('a', 501)], 'description'],
    ]);
});

describe('withdrawing a submission', function () {
    test('contributors can withdraw their pending submission', function () {
        $user = User::factory()->create();
        $space = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);

        $this->actingAs($user)->delete(route('profile.parking-spaces.destroy', $space->id))
            ->assertRedirect(route('profile.parking-spaces.index'));

        $this->assertSoftDeleted($space);
    });

    test('a published place is community data the contributor cannot remove', function () {
        $user = User::factory()->create();
        $space = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::APPROVED]);

        $this->actingAs($user)->delete(route('profile.parking-spaces.destroy', $space->id))->assertForbidden();

        $this->assertNotSoftDeleted($space);
    });

    test('contributors see why their submission was rejected', function () {
        $user = User::factory()->create();
        $space = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::REJECTED]);
        $space->reviews()->create(['to_status' => ParkingStatus::REJECTED, 'reason' => RejectionReason::DUPLICATE, 'reviewed_at' => now()]);

        $this->actingAs($user)->get(route('profile.parking-spaces.show', $space->id))
            ->assertInertia(fn (Assert $page) => $page
                ->where('rejectionReason', RejectionReason::DUPLICATE->label())
                ->where('canWithdraw', false));
    });
});

describe('moderating a submission', function () {
    beforeEach(function () {
        $this->moderator = tap(User::factory()->create())->assignRole(UserRole::MODERATOR);
    });

    test('rejecting requires a reason', function () {
        $space = ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING]);

        $this->actingAs($this->moderator)
            ->put(route('app.parking-spaces.update', $space), moderationPayload($space, ['status' => 'rejected']))
            ->assertSessionHasErrors('rejection_reason');

        expect($space->fresh()->status)->toBe(ParkingStatus::PENDING);
    });

    test('a rejection records its reason and optional note', function () {
        $space = ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING]);

        $this->actingAs($this->moderator)->put(route('app.parking-spaces.update', $space), moderationPayload($space, [
            'status' => 'rejected',
            'rejection_reason' => RejectionReason::WRONG_LOCATION->value,
            'rejection_note' => 'The pin is on the other side of the canal.',
        ]))->assertSessionHasNoErrors();

        expect($space->reviews()->sole())
            ->reason->toBe(RejectionReason::WRONG_LOCATION)
            ->note->toBe('The pin is on the other side of the canal.');
    });

    test('correcting an already rejected place needs no new reason', function () {
        $space = ParkingSpace::factory()->create(['status' => ParkingStatus::REJECTED]);

        $this->actingAs($this->moderator)
            ->put(route('app.parking-spaces.update', $space), moderationPayload($space, ['street' => 'Corrected street']))
            ->assertSessionHasNoErrors();

        expect($space->fresh()->street)->toBe('Corrected street');
    });

    test('approving ignores a stray rejection reason', function () {
        $space = ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING]);

        $this->actingAs($this->moderator)->put(route('app.parking-spaces.update', $space), moderationPayload($space, [
            'status' => 'approved',
            'rejection_reason' => RejectionReason::SPAM->value,
        ]));

        expect($space->reviews()->sole()->reason)->toBeNull();
    });

    test('bulk rejection requires a reason', function () {
        $space = ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING]);

        $this->actingAs($this->moderator)
            ->patch(route('app.parking-spaces.bulk.update'), ['ids' => [$space->id], 'status' => 'rejected'])
            ->assertSessionHasErrors('rejection_reason');

        $this->patch(route('app.parking-spaces.bulk.update'), ['ids' => [$space->id], 'status' => 'rejected', 'rejection_reason' => 'spam']);

        expect($space->reviews()->sole()->reason)->toBe(RejectionReason::SPAM);
    });

    test('moderators may leave the sub-sign unknown on older places', function () {
        $space = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'under_sign' => null]);

        $this->actingAs($this->moderator)
            ->put(route('app.parking-spaces.update', $space), moderationPayload($space, ['under_sign' => '']))
            ->assertSessionHasNoErrors();

        expect($space->fresh()->under_sign)->toBeNull();
    });
});

test('the public detail shows the sub-sign and when it applies', function () {
    $space = ParkingSpace::factory()->withUnderSign()->create(['status' => ParkingStatus::APPROVED]);

    $this->getJson(route('map.parking-spaces.show', $space->id))
        ->assertOk()
        ->assertJsonPath('under_sign.value', 'yes')
        ->assertJsonPath('under_sign_text', 'Ma-vr 09-18 h, max. 2 uur')
        ->assertJsonPath('restriction_days', ['mon', 'tue', 'wed', 'thu', 'fri'])
        ->assertJsonPath('restriction_starts_at', '09:00')
        ->assertJsonPath('restriction_ends_at', '18:00');
});
