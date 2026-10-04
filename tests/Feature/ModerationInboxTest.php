<?php

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Enums\RejectionReason;
use App\Enums\UserRole;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingPlaceReport;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceImprovement;
use App\Models\User;
use App\Notifications\CommunitySpace\StatusChanged;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Notification::fake();
    $this->moderator = tap(User::factory()->create(['locale' => 'nl']))->assignRole(UserRole::MODERATOR);
    $this->contributor = User::factory()->create(['created_at' => now()->subYear()]);
});

function pendingSubmission(User $contributor, array $attributes = []): ParkingSpace
{
    return ParkingSpace::factory()->for($contributor)->create([
        'status' => ParkingStatus::PENDING,
        'orientation' => ParkingOrientation::PARALLEL,
        'under_sign' => null,
        'description' => null,
        ...$attributes,
    ]);
}

function openReportOn(ParkingSpace|ParkingMunicipal $place, array $attributes = []): ParkingPlaceReport
{
    return ParkingPlaceReport::factory()->create([
        'parking_space_id' => $place instanceof ParkingSpace ? $place->id : null,
        'parking_municipal_id' => $place instanceof ParkingMunicipal ? $place->id : null,
        ...$attributes,
    ]);
}

describe('queue', function () {
    test('reports come first, then everything else, each oldest first', function () {
        $this->travelTo('2026-10-01 09:00:00');
        $submission = pendingSubmission($this->contributor);
        $this->travelTo('2026-10-02 09:00:00');
        $improvement = ParkingSpaceImprovement::factory()->create();
        $reported = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
        openReportOn($reported);
        $this->travelTo('2026-10-03 09:00:00');
        $municipal = ParkingMunicipal::factory()->create(['visibility' => true]);
        openReportOn($municipal);

        $this->actingAs($this->moderator)->get(route('app.moderation.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('backend/moderation/index')
                ->where('items.total', 4)
                ->where('items.data.0.key', "report:community:{$reported->id}")
                ->where('items.data.0.priority', 'high')
                ->where('items.data.1.key', "report:municipal:{$municipal->id}")
                ->where('items.data.2.key', "submission:{$submission->id}")
                ->where('items.data.2.priority', 'normal')
                ->where('items.data.3.key', "improvement:{$improvement->id}"));
    });

    test('what is known about a contributor is context and never changes the order', function () {
        $this->travelTo('2026-10-01 09:00:00');
        $older = pendingSubmission(User::factory()->create(['created_at' => now()]));
        $this->travelTo('2026-10-02 09:00:00');
        $trusted = pendingSubmission($this->contributor);
        ParkingSpace::factory()->for($this->contributor)->count(3)->create(['status' => ParkingStatus::APPROVED]);

        $this->actingAs($this->moderator)->get(route('app.moderation.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('items.data.0.key', "submission:{$older->id}")
                ->where('items.data.0.contributor.is_new', true)
                ->where('items.data.1.key', "submission:{$trusted->id}")
                ->where('items.data.1.contributor.approved', 3)
                ->where('items.data.1.contributor.is_new', false));
    });

    test('a submission close to a visible municipal place says so', function () {
        $space = pendingSubmission($this->contributor, ['latitude' => 52.0827, 'longitude' => 4.3141]);
        ParkingMunicipal::factory()->create(['visibility' => true, 'latitude' => 52.08275, 'longitude' => 4.31415]);

        $this->actingAs($this->moderator)->get(route('app.moderation.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('items.data.0.key', "submission:{$space->id}")
                ->where('items.data.0.flags.nearby_municipal_metres', fn (int $metres) => $metres > 0 && $metres < 10));
    });

    test('the queue narrows to a kind of item and a municipality', function () {
        $utrecht = Municipality::factory()->create(['name' => 'Utrecht']);
        $inUtrecht = pendingSubmission($this->contributor, ['municipality_id' => $utrecht->id]);
        pendingSubmission($this->contributor);
        ParkingSpaceImprovement::factory()->create();

        $this->actingAs($this->moderator)->get(route('app.moderation.index', ['type' => 'submission', 'municipality_id' => $utrecht->id]))
            ->assertInertia(fn (Assert $page) => $page
                ->has('items.data', 1)
                ->where('items.data.0.key', "submission:{$inUtrecht->id}")
                ->where('filters.types', ['submission'])
                ->where('filters.municipality_ids', [(string) $utrecht->id]));
    });

    test('each person sees only the kinds of items they may moderate', function () {
        pendingSubmission($this->contributor);
        ParkingSpaceImprovement::factory()->create();
        openReportOn(ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]));
        $reportsOnly = tap(User::factory()->create())->givePermissionTo('parking-place-report.view_any');

        $this->actingAs($reportsOnly)->get(route('app.moderation.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('items.total', 1)
                ->where('items.data.0.type', 'report')
                ->where('options.types', ['report'])
                ->where('counts.moderation.open', 1));

        $this->actingAs(User::factory()->create())->get(route('app.moderation.index'))->assertForbidden();
    });

    test('the navigation counts every open item a moderator may act on', function () {
        pendingSubmission($this->contributor);
        ParkingSpaceImprovement::factory()->create();
        $reported = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
        openReportOn($reported);
        openReportOn($reported);

        $this->actingAs($this->moderator)->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page->where('counts.moderation.open', 3));
    });

    test('items for a parking space in the trash wait until it is restored', function () {
        $trashed = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
        ParkingSpaceImprovement::factory()->for($trashed)->create();
        openReportOn($trashed);
        $trashed->delete();
        $submission = pendingSubmission($this->contributor);

        $this->actingAs($this->moderator)->get(route('app.moderation.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('items.total', 1)
                ->where('items.data.0.key', "submission:{$submission->id}")
                ->where('counts.moderation.open', 1));
    });

    test('the former queues lead into the inbox', function () {
        $improvement = ParkingSpaceImprovement::factory()->create();

        $this->actingAs($this->moderator);
        $this->get('/app/improvements')->assertRedirect(route('app.moderation.index', ['type' => 'improvement']));
        $this->get("/app/improvements/{$improvement->id}")->assertRedirect(route('app.moderation.improvements.show', $improvement));
        $this->get('/app/reports')->assertRedirect(route('app.moderation.index', ['type' => 'report']));
    });
});

describe('submissions', function () {
    test('a moderator reviews a submission with the places around it', function () {
        $space = pendingSubmission($this->contributor, ['street' => 'Lange Voorhout']);

        $this->actingAs($this->moderator)->get(route('app.moderation.submissions.show', $space))
            ->assertInertia(fn (Assert $page) => $page
                ->where('selected.key', "submission:{$space->id}")
                ->where('selected.details.space.street', 'Lange Voorhout')
                ->where('selected.details.current.orientation', 'parallel')
                ->has('selected.details.nearbySpaces')
                ->has('selected.details.nearbyMunicipalSpaces')
                ->where('position.index', 1));
    });

    test('a moderator corrects a submission, approves it and continues with the next item', function () {
        $space = pendingSubmission($this->contributor, ['created_at' => now()->subDays(2)]);
        $next = pendingSubmission($this->contributor);

        $this->actingAs($this->moderator)
            ->post(route('app.moderation.submissions.approve', $space), [
                'latitude' => $space->latitude,
                'longitude' => $space->longitude,
                'orientation' => ParkingOrientation::PERPENDICULAR->value,
                'under_sign' => null,
                'description' => 'Naast de ingang',
            ])
            ->assertSessionHasNoErrors()
            ->assertInertiaFlash('success', 'De parkeerplaats is goedgekeurd en staat op de kaart.')
            ->assertRedirect(route('app.moderation.submissions.show', $next));

        expect($space->fresh())
            ->status->toBe(ParkingStatus::APPROVED)
            ->orientation->toBe(ParkingOrientation::PERPENDICULAR)
            ->description->toBe('Naast de ingang')
            ->and($space->reviews()->sole())->reviewed_by->toBe($this->moderator->id)->to_status->toBe(ParkingStatus::APPROVED);
        Notification::assertSentTo($this->contributor, StatusChanged::class);
    });

    test('a decision keeps the filters the moderator was working with', function () {
        $space = pendingSubmission($this->contributor, ['created_at' => now()->subDays(2)]);
        $next = pendingSubmission($this->contributor);
        ParkingSpaceImprovement::factory()->create(['created_at' => now()->subDay()]);

        $this->actingAs($this->moderator)
            ->post(route('app.moderation.submissions.reject', [$space, 'type' => 'submission']), ['reason' => RejectionReason::DUPLICATE->value])
            ->assertRedirect(route('app.moderation.submissions.show', [$next, 'type' => 'submission']));
    });

    test('a rejected submission keeps its reason and note', function () {
        $space = pendingSubmission($this->contributor);

        $this->actingAs($this->moderator)
            ->post(route('app.moderation.submissions.reject', $space), [])
            ->assertSessionHasErrors('reason');

        $this->post(route('app.moderation.submissions.reject', $space), ['reason' => RejectionReason::DUPLICATE->value, 'note' => ' Gemeentelijke plek '])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('app.moderation.index'));

        expect($space->fresh()->status)->toBe(ParkingStatus::REJECTED)
            ->and($space->reviews()->sole())->reason->toBe(RejectionReason::DUPLICATE)->note->toBe('Gemeentelijke plek');
    });

    test('a decided submission is not decided again', function () {
        $space = pendingSubmission($this->contributor, ['status' => ParkingStatus::APPROVED]);

        $this->actingAs($this->moderator)
            ->post(route('app.moderation.submissions.reject', $space), ['reason' => 'spam'])
            ->assertNotFound();
        $this->get(route('app.moderation.submissions.show', $space))->assertRedirect(route('app.moderation.index'));
    });
});

describe('bulk rejection', function () {
    test('submissions and improvements are rejected together with one reason', function () {
        $spam = pendingSubmission($this->contributor);
        $improvement = ParkingSpaceImprovement::factory()->create();

        $this->actingAs($this->moderator)
            ->post(route('app.moderation.bulk.reject'), ['items' => ["submission:{$spam->id}", "improvement:{$improvement->id}"], 'reason' => 'spam'])
            ->assertSessionHasNoErrors()
            ->assertInertiaFlash('success', '2 items afgewezen.');

        expect($spam->fresh()->status)->toBe(ParkingStatus::REJECTED)
            ->and($spam->reviews()->sole()->reason)->toBe(RejectionReason::SPAM)
            ->and($improvement->fresh()->status)->toBe(ParkingStatus::REJECTED);
    });

    test('only reasons that fit every kind are accepted, and reports are never rejected in bulk', function () {
        $space = pendingSubmission($this->contributor);
        $reported = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
        openReportOn($reported);

        $this->actingAs($this->moderator)
            ->post(route('app.moderation.bulk.reject'), ['items' => ["submission:{$space->id}"], 'reason' => RejectionReason::DUPLICATE->value])
            ->assertSessionHasErrors('reason');

        $this->post(route('app.moderation.bulk.reject'), ['items' => ["report:community:{$reported->id}"], 'reason' => 'spam'])
            ->assertSessionHasErrors('items.0');

        expect($space->fresh()->status)->toBe(ParkingStatus::PENDING)
            ->and($reported->reports()->open()->count())->toBe(1);
    });

    test('seeing an item does not grant deciding on it', function () {
        $space = pendingSubmission($this->contributor);
        $improvement = ParkingSpaceImprovement::factory()->create();
        $viewer = tap(User::factory()->create())->givePermissionTo(['parking-space.view_any', 'parking-space-improvement.view_any']);

        $this->actingAs($viewer);
        $this->get(route('app.moderation.submissions.show', $space))->assertOk();
        $this->post(route('app.moderation.submissions.reject', $space), ['reason' => 'spam'])->assertForbidden();
        $this->post(route('app.moderation.bulk.reject'), ['items' => ["improvement:{$improvement->id}"], 'reason' => 'spam'])->assertForbidden();

        expect($space->fresh()->status)->toBe(ParkingStatus::PENDING)
            ->and($improvement->fresh()->status)->toBe(ParkingStatus::PENDING);
    });

    test('malformed items are refused before anything is rejected', function (string $key) {
        $space = pendingSubmission($this->contributor);

        $this->actingAs($this->moderator)
            ->post(route('app.moderation.bulk.reject'), ['items' => ["submission:{$space->id}", $key], 'reason' => 'spam'])
            ->assertSessionHasErrors('items.1');

        expect($space->fresh()->status)->toBe(ParkingStatus::PENDING);
    })->with(['improvement', 'submission:abc', 'report:community:1', 'improvement:1;drop']);

    test('the community list no longer approves in bulk', function () {
        $space = pendingSubmission($this->contributor);

        $this->actingAs($this->moderator)
            ->patch(route('app.parking-spaces.bulk.update'), ['ids' => [$space->id], 'status' => ParkingStatus::APPROVED->value])
            ->assertSessionHasErrors('status');

        expect($space->fresh()->status)->toBe(ParkingStatus::PENDING);
    });
});

describe('history', function () {
    test('decided items of every kind are listed most recent first', function () {
        $space = pendingSubmission($this->contributor, ['street' => 'Lange Voorhout']);
        $reported = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'street' => 'Oudegracht']);
        openReportOn($reported);
        $kept = ParkingMunicipal::factory()->create(['visibility' => true, 'street' => 'Stationsplein']);
        openReportOn($kept);
        openReportOn($kept);

        $this->actingAs($this->moderator);
        $this->travelTo('2026-10-01 09:00:00');
        $this->post(route('app.moderation.submissions.reject', $space), ['reason' => RejectionReason::DUPLICATE->value]);
        $this->travelTo('2026-10-02 09:00:00');
        $this->post(route('app.moderation.reports.remove', ['source' => 'community', 'id' => $reported->id]), ['reason' => 'no_longer_exists']);
        $this->travelTo('2026-10-03 09:00:00');
        $this->post(route('app.moderation.reports.keep', ['source' => 'municipal', 'id' => $kept->id]));

        $this->get(route('app.moderation.index', ['status' => 'decided']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('status', 'decided')
                ->where('items', null)
                ->has('history.data', 3)
                ->where('history.data.0.decision', 'kept')
                ->where('history.data.0.street', 'Stationsplein')
                ->where('history.data.0.reports', 2)
                ->where('history.data.1.decision', 'removed')
                ->where('history.data.1.reviewer', $this->moderator->name)
                ->where('history.data.2.type', 'submission')
                ->where('history.data.2.decision', 'rejected')
                ->where('history.data.2.reason', RejectionReason::DUPLICATE->label())
                ->where('history.data.2.contributor', $this->contributor->name));
    });
});
