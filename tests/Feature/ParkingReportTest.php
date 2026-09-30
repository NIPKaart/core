<?php

use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingStatus;
use App\Enums\RemovalAction;
use App\Enums\RemovalReason;
use App\Enums\ReportReason;
use App\Enums\ReportResolution;
use App\Enums\UserRole;
use App\Models\Favorite;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingPlaceRemoval;
use App\Models\ParkingPlaceReport;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceConfirmation;
use App\Models\ParkingSpaceReview;
use App\Models\User;
use App\Notifications\ParkingPlace\ReportResolved;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Notification::fake();
    $this->user = User::factory()->create(['locale' => 'nl']);
    $this->moderator = tap(User::factory()->create(['locale' => 'nl']))->assignRole(UserRole::MODERATOR);
});

dataset('reportable places', [
    'community' => fn () => ['community', ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'street' => 'Breestraat'])],
    'municipal' => fn () => ['municipal', ParkingMunicipal::factory()->create(['visibility' => true, 'street' => 'Breestraat'])],
]);

function reportOf(ParkingSpace|ParkingMunicipal $place, array $attributes = []): ParkingPlaceReport
{
    return ParkingPlaceReport::factory()->create([
        'parking_space_id' => $place instanceof ParkingSpace ? $place->id : null,
        'parking_municipal_id' => $place instanceof ParkingMunicipal ? $place->id : null,
        ...$attributes,
    ]);
}

function isPublished(ParkingSpace|ParkingMunicipal $place): bool
{
    $place->refresh();

    return $place instanceof ParkingSpace ? $place->status === ParkingStatus::APPROVED : $place->visibility;
}

describe('reporting', function () {
    test('signed-in users report that a published place is gone without taking it off the map', function (array $case) {
        [$source, $place] = $case;

        $this->actingAs($this->user)
            ->post(route('map.places.report', ['source' => $source, 'id' => $place->id]), ['note' => '  Bord is weggehaald  '])
            ->assertSessionHasNoErrors()
            ->assertInertiaFlash('success', 'Bedankt. Een moderator bekijkt je melding; tot die tijd blijft de parkeerplaats op de kaart.');

        expect($place->reports()->sole())
            ->user_id->toBe($this->user->id)
            ->note->toBe('Bord is weggehaald')
            ->resolved_at->toBeNull()
            ->and(isPublished($place))->toBeTrue();
    })->with('reportable places');

    test('places the public map does not show cannot be reported', function (string $source, Closure $id) {
        $this->actingAs($this->user)->post("/map/places/{$source}/{$id()}/report")->assertNotFound();

        expect(ParkingPlaceReport::count())->toBe(0);
    })->with([
        'pending community place' => ['community', fn () => ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING])->id],
        'hidden municipal place' => ['municipal', fn () => ParkingMunicipal::factory()->create(['visibility' => false])->id],
        'garage' => ['offstreet', fn () => ParkingOffstreet::factory()->create(['visibility' => true])->id],
    ]);

    test('a user has one open report per place and may report again after a decision', function () {
        $place = ParkingMunicipal::factory()->create(['visibility' => true]);
        $report = fn () => $this->post(route('map.places.report', ['source' => 'municipal', 'id' => $place->id]));

        $this->actingAs($this->user);
        $report()->assertSessionHasNoErrors();
        $report()->assertSessionHasErrors(['general' => 'Je hebt deze parkeerplaats al gemeld. Een moderator bekijkt het.']);
        $this->actingAs(User::factory()->create());
        $report()->assertSessionHasNoErrors();
        expect($place->reports()->count())->toBe(2);

        $this->actingAs($this->moderator)->post(route('app.reports.keep', ['source' => 'municipal', 'id' => $place->id]));
        $this->actingAs($this->user);
        $report()->assertSessionHasNoErrors();
        expect($place->reports()->open()->count())->toBe(1);
    });

    test('a reporter may say what they saw from a fixed list', function () {
        $place = ParkingMunicipal::factory()->create(['visibility' => true]);
        $report = fn (array $data) => $this->post(route('map.places.report', ['source' => 'municipal', 'id' => $place->id]), $data);

        $this->actingAs($this->user);
        $report(['reason' => 'looks-odd'])->assertSessionHasErrors('reason');
        $report(['reason' => ReportReason::NOW_REGULAR_BAY->value])->assertSessionHasNoErrors();

        expect($place->reports()->sole()->reason)->toBe(ReportReason::NOW_REGULAR_BAY);
    });

    test('the note is optional but bounded', function () {
        $place = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);

        $this->actingAs($this->user)
            ->post(route('map.places.report', ['source' => 'community', 'id' => $place->id]), ['note' => str_repeat('a', 501)])
            ->assertSessionHasErrors('note');

        expect($place->reports()->count())->toBe(0);
    });

    test('public details tell only the reporter about their open report', function (array $case) {
        [$source, $place] = $case;
        reportOf($place, ['user_id' => $this->user->id]);
        $detail = route($source === 'community' ? 'map.parking-spaces.show' : 'map.parking-municipal.show', $place->id);

        $this->actingAs($this->user)->getJson($detail)->assertJsonPath('reported_by_you', true);
        $this->actingAs(User::factory()->create())->getJson($detail)
            ->assertJsonPath('reported_by_you', false)
            ->assertJsonMissingPath('reports');
    })->with('reportable places');

    test('a report targets exactly one place', function (array $targets) {
        expect(fn () => ParkingPlaceReport::factory()->create($targets))->toThrow(QueryException::class);
    })->with([
        'no place' => fn () => ['parking_space_id' => null],
        'two places' => fn () => ['parking_municipal_id' => ParkingMunicipal::factory()->create()->id],
    ]);
});

describe('moderation', function () {
    test('only moderators and administrators see and handle reports', function (UserRole $role, bool $allowed) {
        $place = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
        reportOf($place);
        $this->actingAs(tap(User::factory()->create())->assignRole($role));

        $this->get(route('app.reports.index'))->assertStatus($allowed ? 200 : 403);
        $this->post(route('app.reports.keep', ['source' => 'community', 'id' => $place->id]))->assertStatus($allowed ? 302 : 403);
        expect($place->reports()->open()->exists())->toBe(! $allowed);
    })->with([
        'administrator' => [UserRole::ADMIN, true],
        'moderator' => [UserRole::MODERATOR, true],
        'user' => [UserRole::USER, false],
    ]);

    test('the queue lists each reported place once with its reports and later confirmations', function () {
        $this->travelTo('2026-09-20 12:00:00');
        $community = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED, 'street' => 'Breestraat']);
        $municipal = ParkingMunicipal::factory()->create(['visibility' => true]);
        ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
        ParkingSpaceConfirmation::factory()->for($community)->create(['confirmed_at' => '2026-09-19 10:00:00']);
        $reporter = User::factory()->create(['name' => 'Anne']);
        reportOf($community, ['user_id' => $reporter->id, 'reason' => ReportReason::SIGN_REMOVED, 'note' => 'Vak overgeschilderd']);
        reportOf($community, ['resolved_at' => now(), 'resolution' => ReportResolution::KEPT]);
        $this->travelTo('2026-09-22 12:00:00');
        reportOf($community);
        ParkingSpaceConfirmation::factory()->for($community)->create(['confirmed_at' => '2026-09-21 10:00:00']);
        ParkingSpaceConfirmation::factory()->for($community)->create(['confirmed_at' => '2026-09-21 11:00:00', 'status' => ParkingConfirmationStatus::MOVED]);
        $this->travelTo('2026-09-23 12:00:00');
        reportOf($municipal);

        $this->actingAs($this->moderator)->get(route('app.reports.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('backend/reports/index')
                ->has('places', 2)
                ->where('places.0.key', "municipal:{$municipal->id}")
                ->where('places.1.key', "community:{$community->id}")
                ->where('places.1.street', 'Breestraat')
                ->where('places.1.published', true)
                ->has('places.1.reports', 2)
                ->where('places.1.reports.0.reporter', 'Anne')
                ->where('places.1.reports.0.note', 'Vak overgeschilderd')
                ->where('places.1.reports.0.reason', 'Bord of vak is weggehaald')
                ->where('places.1.reports.1.reason', null)
                ->where('places.1.confirmations_since_report', 1)
                ->where('places.1.last_confirmed_at', '2026-09-21T10:00:00+00:00')
                ->has('options.removalReasons', count(RemovalReason::cases())));
    });

    test('moderators see how many places await a decision', function () {
        $place = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
        reportOf($place);
        reportOf($place);
        reportOf(ParkingMunicipal::factory()->create());

        $this->actingAs($this->moderator)->get(route('app.reports.index'))->assertInertia(fn (Assert $page) => $page->where('counts.reports.open', 2));
        $this->actingAs($this->user)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page->where('counts.reports.open', 0));
    });

    test('keeping a place closes its reports and leaves it published', function (array $case) {
        [$source, $place] = $case;
        reportOf($place);

        $this->actingAs($this->moderator)
            ->post(route('app.reports.keep', ['source' => $source, 'id' => $place->id]))
            ->assertSessionHasNoErrors()
            ->assertInertiaFlash('success', 'De parkeerplaats blijft op de kaart en de meldingen zijn afgehandeld.');

        expect($place->reports()->sole())
            ->resolution->toBe(ReportResolution::KEPT)
            ->resolved_by->toBe($this->moderator->id)
            ->resolved_at->not->toBeNull()
            ->and(isPublished($place))->toBeTrue()
            ->and(ParkingPlaceRemoval::count())->toBe(0);
    })->with('reportable places');

    test('reporters hear that the place stays, with a link back to it', function (array $case) {
        [$source, $place] = $case;
        $report = reportOf($place);

        $this->actingAs($this->moderator)->post(route('app.reports.keep', ['source' => $source, 'id' => $place->id]));

        Notification::assertSentTo($report->user, ReportResolved::class, fn (ReportResolved $notification) => ! $notification->removed
            && str_starts_with($notification->placeLabel, 'Breestraat')
            && $notification->placeUrl === route('location-map', ['place' => "{$source}:{$place->id}", 'at' => sprintf('%.5f,%.5f', $place->latitude, $place->longitude)]));
    })->with('reportable places');

    test('every reporter hears why a place was removed', function (array $case) {
        [$source, $place] = $case;
        $reports = [reportOf($place), reportOf($place)];

        $this->actingAs($this->moderator)
            ->post(route('app.reports.remove', ['source' => $source, 'id' => $place->id]), ['reason' => RemovalReason::DUPLICATE->value]);

        foreach ($reports as $report) {
            Notification::assertSentTo($report->user, ReportResolved::class, fn (ReportResolved $notification) => $notification->removed
                && $notification->reason === RemovalReason::DUPLICATE->value
                && $notification->placeUrl === null);
        }
    })->with('reportable places');

    test('removal requires a reported place and a bounded reason', function () {
        $place = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
        $remove = fn (array $data) => $this->post(route('app.reports.remove', ['source' => 'community', 'id' => $place->id]), $data);

        $this->actingAs($this->moderator);
        $remove(['reason' => RemovalReason::NO_LONGER_EXISTS->value])->assertNotFound();
        reportOf($place);
        $remove([])->assertSessionHasErrors('reason');
        $remove(['reason' => 'looks-wrong'])->assertSessionHasErrors('reason');
        $remove(['reason' => RemovalReason::OTHER->value, 'note' => str_repeat('a', 1001)])->assertSessionHasErrors('note');

        $this->assertModelExists($place);
    });

    test('removing a community place deletes it with everything that only described it', function () {
        $owner = User::factory()->create();
        $place = ParkingSpace::factory()->for($owner)->create(['status' => ParkingStatus::APPROVED, 'street' => 'Breestraat']);
        $confirmation = ParkingSpaceConfirmation::factory()->for($place)->create();
        $review = ParkingSpaceReview::factory()->for($place)->create();
        $favorite = Favorite::factory()->for($place, 'favoritable')->create();
        $reports = [reportOf($place), reportOf($place, ['note' => 'Weg'])];

        $this->actingAs($this->moderator)
            ->post(route('app.reports.remove', ['source' => 'community', 'id' => $place->id]), ['reason' => RemovalReason::NO_LONGER_EXISTS->value, 'note' => ' Ter plekke gecontroleerd '])
            ->assertSessionHasNoErrors()
            ->assertInertiaFlash('success', 'De parkeerplaats van de community is verwijderd.');

        expect(ParkingSpace::withTrashed()->find($place->id))->toBeNull();
        foreach ([$confirmation, $review, $favorite, ...$reports] as $dependent) {
            $this->assertModelMissing($dependent);
        }
        expect(ParkingPlaceRemoval::sole())
            ->source->toBe('community')
            ->place_id->toBe($place->id)
            ->place_label->toBe("Breestraat, {$place->municipality->name}")
            ->action->toBe(RemovalAction::DELETED)
            ->reason->toBe(RemovalReason::NO_LONGER_EXISTS)
            ->note->toBe('Ter plekke gecontroleerd')
            ->open_reports->toBe(2)
            ->removed_by->toBe($this->moderator->id);
    });

    test('removing a municipal place hides it but keeps the imported record and its history', function () {
        $place = ParkingMunicipal::factory()->create(['visibility' => true]);
        $confirmation = ParkingSpaceConfirmation::factory()->municipal()->create(['parking_municipal_id' => $place->id]);
        $favorite = Favorite::factory()->for($place, 'favoritable')->create();
        reportOf($place);

        $this->actingAs($this->moderator)
            ->post(route('app.reports.remove', ['source' => 'municipal', 'id' => $place->id]), ['reason' => RemovalReason::NO_LONGER_EXISTS->value])
            ->assertSessionHasNoErrors()
            ->assertInertiaFlash('success', 'De gemeentelijke parkeerplaats is verborgen op de kaart.');

        expect($place->fresh()->visibility)->toBeFalse()
            ->and($place->reports()->sole())->resolution->toBe(ReportResolution::REMOVED)->resolved_by->toBe($this->moderator->id)
            ->and(ParkingPlaceRemoval::sole())->action->toBe(RemovalAction::HIDDEN)->place_id->toBe($place->id)->note->toBeNull();
        $this->assertModelExists($confirmation);
        $this->assertModelExists($favorite);
        $this->getJson(route('map.parking-municipal.show', $place->id))->assertNotFound();
    });
});
