<?php

use App\Enums\ImprovementRejectionReason;
use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Enums\UnderSign;
use App\Enums\UserRole;
use App\Models\Municipality;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceImprovement;
use App\Models\User;
use App\Notifications\CommunitySpace\ImprovementDecided;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Notification::fake();
    $this->user = User::factory()->create(['locale' => 'nl']);
    $this->moderator = tap(User::factory()->create(['locale' => 'nl']))->assignRole(UserRole::MODERATOR);
    $this->space = ParkingSpace::factory()->create([
        'status' => ParkingStatus::APPROVED,
        'latitude' => 52.37,
        'longitude' => 4.9,
        'street' => 'Breestraat',
        'orientation' => ParkingOrientation::PARALLEL,
        'under_sign' => null,
        'description' => null,
    ]);
});

/**
 * The improvement form as it opens: the space's current pin and details.
 *
 * @return array<string, mixed>
 */
function currentForm(ParkingSpace $space, array $overrides = []): array
{
    return [
        'latitude' => $space->latitude,
        'longitude' => $space->longitude,
        'orientation' => $space->orientation->value,
        'under_sign' => $space->under_sign?->value,
        'description' => $space->description,
        ...$overrides,
    ];
}

describe('proposing', function () {
    test('any signed-in user proposes only what changed, and the public space stays as it is', function () {
        $this->actingAs($this->user)
            ->post(route('map.places.improve.store', $this->space), currentForm($this->space, [
                'orientation' => ParkingOrientation::PERPENDICULAR->value,
                'description' => '  Naast de ingang  ',
            ]))
            ->assertSessionHasNoErrors()
            ->assertInertiaFlash('success', 'Bedankt. Een moderator bekijkt je verbetering; tot die tijd blijft de huidige informatie zichtbaar.')
            ->assertRedirect(route('location-map', ['place' => "community:{$this->space->id}", 'at' => '52.37000,4.90000']));

        expect($this->space->improvements()->sole())
            ->user_id->toBe($this->user->id)
            ->status->toBe(ParkingStatus::PENDING)
            ->submitted->toEqual(['orientation' => 'perpendicular', 'description' => 'Naast de ingang'])
            ->and($this->space->fresh())
            ->orientation->toBe(ParkingOrientation::PARALLEL)
            ->description->toBeNull();

        $this->getJson(route('map.parking-spaces.show', $this->space->id))
            ->assertJsonPath('orientation.value', 'parallel')
            ->assertJsonPath('improvement_pending', true);
    });

    test('a moved pin is resolved again and proposes the whole new location', function () {
        $elsewhere = Municipality::factory()->create();
        fakeReverseGeocoding($elsewhere, ['street' => 'Nieuwe Weg']);

        $this->actingAs($this->user)
            ->post(route('map.places.improve.store', $this->space), currentForm($this->space, ['latitude' => 52.3712345, 'longitude' => 4.8912345]))
            ->assertSessionHasNoErrors();

        expect($this->space->improvements()->sole()->submitted)
            ->toMatchArray([
                'latitude' => 52.3712345,
                'longitude' => 4.8912345,
                'country_id' => $elsewhere->country_id,
                'municipality_id' => $elsewhere->id,
                'street' => 'Nieuwe Weg',
            ])
            ->not->toHaveKey('orientation');
    });

    test('a moved pin that does not resolve to a municipality is refused', function () {
        fakeReverseGeocoding(Municipality::factory()->create(), ['country_code' => 'zz']);

        $this->actingAs($this->user)
            ->post(route('map.places.improve.store', $this->space), currentForm($this->space, ['latitude' => 52.38]))
            ->assertSessionHasErrors('latitude');

        expect(ParkingSpaceImprovement::count())->toBe(0);
    });

    test('an unmoved pin is not looked up again', function () {
        Http::fake();

        $this->actingAs($this->user)
            ->post(route('map.places.improve.store', $this->space), currentForm($this->space, ['under_sign' => 'no']))
            ->assertSessionHasNoErrors();

        Http::assertNothingSent();
        expect($this->space->improvements()->sole()->submitted)->toBe(['under_sign' => 'no']);
    });

    test('a proposal that changes nothing is refused', function () {
        $this->actingAs($this->user)
            ->post(route('map.places.improve.store', $this->space), currentForm($this->space))
            ->assertSessionHasErrors(['general' => 'Je hebt nog niets veranderd.']);
    });

    test('a user has one pending proposal per space', function () {
        ParkingSpaceImprovement::factory()->for($this->space)->for($this->user)->create();

        $this->actingAs($this->user)
            ->post(route('map.places.improve.store', $this->space), currentForm($this->space, ['under_sign' => 'yes']))
            ->assertSessionHasErrors('general');

        expect($this->space->improvements()->count())->toBe(1);
    });

    test('spaces the public map does not show cannot be improved', function (ParkingStatus $status) {
        $space = ParkingSpace::factory()->create(['status' => $status]);

        $this->actingAs($this->user)->get(route('map.places.improve.create', $space))->assertNotFound();
        $this->post(route('map.places.improve.store', $space), currentForm($space, ['under_sign' => 'yes']))->assertNotFound();
    })->with([ParkingStatus::PENDING, ParkingStatus::REJECTED]);

    test('the improvement flow opens with the current information', function () {
        $this->actingAs($this->user)->get(route('map.places.improve.create', $this->space))
            ->assertInertia(fn (Assert $page) => $page
                ->component('frontend/map/contribute')
                ->where('improving', true)
                ->where('parkingSpace.id', $this->space->id)
                ->where('parkingSpace.orientation', 'parallel'));
    });

    test('guests are sent to log in', function () {
        $this->get(route('map.places.improve.create', $this->space))->assertRedirect(route('login'));
    });
});

describe('moderating', function () {
    beforeEach(function () {
        $this->improvement = ParkingSpaceImprovement::factory()->for($this->space)->for($this->user)->create([
            'submitted' => ['orientation' => 'perpendicular', 'under_sign' => 'yes'],
            'created_at' => now()->subDays(2),
        ]);
    });

    test('the inbox lists open proposals oldest first with what they change', function () {
        $newer = ParkingSpaceImprovement::factory()->create(['submitted' => ['description' => 'Naast de apotheek']]);

        $this->actingAs($this->moderator)->get(route('app.moderation.index', ['type' => 'improvement']))
            ->assertInertia(fn (Assert $page) => $page
                ->component('backend/moderation/index')
                ->where('status', 'open')
                ->has('items.data', 2)
                ->where('items.data.0.key', "improvement:{$this->improvement->id}")
                ->where('items.data.0.changes', ['orientation', 'under_sign'])
                ->where('items.data.0.contributor.name', $this->user->name)
                ->where('items.data.1.key', "improvement:{$newer->id}"));
    });

    test('the inbox narrows to a search', function () {
        ParkingSpaceImprovement::factory()->create(['submitted' => ['latitude' => 52.38, 'longitude' => 4.91, 'street' => 'Nieuwe Weg']]);

        $this->actingAs($this->moderator)->get(route('app.moderation.index', ['type' => 'improvement', 'search' => 'breestr']))
            ->assertInertia(fn (Assert $page) => $page->has('items.data', 1)->where('items.data.0.key', "improvement:{$this->improvement->id}"));
    });

    test('a moderator reviews one proposal with its place in the queue', function () {
        $next = ParkingSpaceImprovement::factory()->create();

        $this->actingAs($this->moderator)->get(route('app.moderation.improvements.show', $this->improvement))
            ->assertInertia(fn (Assert $page) => $page
                ->component('backend/moderation/index')
                ->where('selected.key', "improvement:{$this->improvement->id}")
                ->where('selected.details.current.orientation', 'parallel')
                ->where('selected.details.submitted.orientation', 'perpendicular')
                ->where('selected.details.changes', ['orientation', 'under_sign'])
                ->where('position.index', 1)
                ->where('position.total', 2)
                ->where('position.previous', null)
                ->where('position.next', ['key' => "improvement:{$next->id}", 'type' => 'improvement', 'route' => ['improvement' => $next->id]]));
    });

    test('a moderator corrects the proposal, approves it and continues with the next one', function () {
        $next = ParkingSpaceImprovement::factory()->create();

        $this->actingAs($this->moderator)
            ->post(route('app.moderation.improvements.approve', $this->improvement), currentForm($this->space, [
                'orientation' => 'perpendicular',
                'under_sign' => 'yes',
                'under_sign_text' => 'Ma-vr 9-18 uur',
            ]))
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('app.moderation.improvements.show', $next));

        expect($this->space->fresh())
            ->orientation->toBe(ParkingOrientation::PERPENDICULAR)
            ->under_sign->toBe(UnderSign::YES)
            ->under_sign_text->toBe('Ma-vr 9-18 uur')
            ->and($this->improvement->fresh())
            ->status->toBe(ParkingStatus::APPROVED)
            ->submitted->toEqual(['orientation' => 'perpendicular', 'under_sign' => 'yes'])
            ->approved->toEqual(['orientation' => 'perpendicular', 'under_sign' => 'yes', 'under_sign_text' => 'Ma-vr 9-18 uur'])
            ->previous->toEqual(['orientation' => 'parallel', 'under_sign' => null, 'under_sign_text' => null])
            ->reviewed_by->toBe($this->moderator->id);
    });

    test('an approved location correction moves the space to its resolved municipality', function () {
        $elsewhere = Municipality::factory()->create();
        fakeReverseGeocoding($elsewhere, ['street' => 'Nieuwe Weg']);

        $this->actingAs($this->moderator)
            ->post(route('app.moderation.improvements.approve', $this->improvement), currentForm($this->space, ['latitude' => 52.38, 'longitude' => 4.91]))
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('app.moderation.index'));

        expect($this->space->fresh())
            ->latitude->toBe(52.38)
            ->municipality_id->toBe($elsewhere->id)
            ->street->toBe('Nieuwe Weg');
    });

    test('a moderator rejects a proposal with a reason and the space stays as it is', function () {
        $this->actingAs($this->moderator)
            ->post(route('app.moderation.improvements.reject', $this->improvement), ['reason' => ImprovementRejectionReason::INCORRECT->value, 'note' => 'Klopt niet'])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('app.moderation.index'));

        expect($this->improvement->fresh())
            ->status->toBe(ParkingStatus::REJECTED)
            ->reason->toBe(ImprovementRejectionReason::INCORRECT)
            ->note->toBe('Klopt niet')
            ->and($this->space->fresh()->orientation)->toBe(ParkingOrientation::PARALLEL);
    });

    test('the proposer hears that their improvement was applied, with a link back to the space', function () {
        $this->actingAs($this->moderator)
            ->post(route('app.moderation.improvements.approve', $this->improvement), currentForm($this->space, ['orientation' => 'perpendicular']))
            ->assertSessionHasNoErrors();

        Notification::assertSentTo($this->user, ImprovementDecided::class, fn (ImprovementDecided $notification, array $channels) => $notification->approved
            && $notification->changes === ['orientation']
            && $notification->spaceLabel === 'Breestraat'
            && $notification->placeUrl === route('location-map', ['place' => "community:{$this->space->id}", 'at' => '52.37000,4.90000'])
            && $channels === ['database', 'broadcast']);
    });

    test('each proposer hears why their improvement was rejected, also when rejected in bulk', function () {
        $other = ParkingSpaceImprovement::factory()->create();

        $this->actingAs($this->moderator)
            ->post(route('app.moderation.bulk.reject'), ['items' => ["improvement:{$this->improvement->id}", "improvement:{$other->id}"], 'reason' => 'spam'])
            ->assertSessionHasNoErrors();

        foreach ([$this->user, $other->user] as $proposer) {
            Notification::assertSentTo($proposer, ImprovementDecided::class, fn (ImprovementDecided $notification) => ! $notification->approved
                && $notification->reason === ImprovementRejectionReason::SPAM->value);
        }
    });

    test('a rejection needs a reason', function () {
        $this->actingAs($this->moderator)
            ->post(route('app.moderation.improvements.reject', $this->improvement))
            ->assertSessionHasErrors('reason');

        expect($this->improvement->fresh()->status)->toBe(ParkingStatus::PENDING);
    });

    test('several open proposals are rejected at once, leaving decided ones alone', function () {
        $spam = ParkingSpaceImprovement::factory()->create();
        $decided = ParkingSpaceImprovement::factory()->create(['status' => ParkingStatus::APPROVED]);

        $this->actingAs($this->moderator)
            ->post(route('app.moderation.bulk.reject'), ['items' => ["improvement:{$this->improvement->id}", "improvement:{$spam->id}", "improvement:{$decided->id}"], 'reason' => 'spam'])
            ->assertSessionHasNoErrors()
            ->assertInertiaFlash('success', '2 items afgewezen.');

        expect($this->improvement->fresh()->status)->toBe(ParkingStatus::REJECTED)
            ->and($spam->fresh()->reason)->toBe(ImprovementRejectionReason::SPAM)
            ->and($decided->fresh()->status)->toBe(ParkingStatus::APPROVED);
    });

    test('decided proposals show what was submitted and what was applied', function () {
        $this->improvement->update([
            'status' => ParkingStatus::APPROVED,
            'approved' => ['orientation' => 'angle'],
            'previous' => ['orientation' => 'parallel'],
            'reviewed_by' => $this->moderator->id,
            'reviewed_at' => now(),
        ]);

        $this->actingAs($this->moderator)->get(route('app.moderation.index', ['status' => 'decided']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('status', 'decided')
                ->has('history.data', 1)
                ->where('history.data.0.type', 'improvement')
                ->where('history.data.0.decision', 'approved')
                ->where('history.data.0.corrected', true)
                ->where('history.data.0.reviewer', $this->moderator->name)
                ->where('history.data.0.applied.orientation', 'angle')
                ->where('history.data.0.previous.orientation', 'parallel'));
    });

    test('a decided proposal cannot be decided again and its review page returns to the inbox', function () {
        $this->improvement->update(['status' => ParkingStatus::REJECTED]);

        $this->actingAs($this->moderator)
            ->post(route('app.moderation.improvements.approve', $this->improvement), currentForm($this->space, ['orientation' => 'perpendicular']))
            ->assertNotFound();
        $this->get(route('app.moderation.improvements.show', $this->improvement))
            ->assertRedirect(route('app.moderation.index'));
    });

    test('users without the moderation permission cannot review', function () {
        $this->actingAs($this->user)->get(route('app.moderation.index'))->assertForbidden();
        $this->get(route('app.moderation.improvements.show', $this->improvement))->assertForbidden();
        $this->post(route('app.moderation.improvements.reject', $this->improvement), ['reason' => 'other'])->assertForbidden();
        $this->post(route('app.moderation.bulk.reject'), ['items' => ["improvement:{$this->improvement->id}"], 'reason' => 'spam'])->assertForbidden();
    });
});
