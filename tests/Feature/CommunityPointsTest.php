<?php

use App\Enums\ImprovementRejectionReason;
use App\Enums\ParkingStatus;
use App\Enums\RejectionReason;
use App\Enums\RemovalReason;
use App\Enums\UserRole;
use App\Models\ParkingPlaceReport;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceConfirmation;
use App\Models\ParkingSpaceImprovement;
use App\Models\User;
use App\Services\CommunityPoints;
use App\Services\ParkingPlaceModeration;
use App\Services\ParkingSpaceImprovements;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

function communityPointsFor(User $user): array
{
    return app(CommunityPoints::class)->profiles([$user->id])[$user->id];
}

test('only reviewed contributions build community points and historical records are not fabricated', function () {
    $user = User::factory()->create();
    $space = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::APPROVED]);
    ParkingSpaceConfirmation::factory()->for($user)->create(['parking_space_id' => $space->id]);

    expect(communityPointsFor($user))->toBe(['score' => 0, 'reviewed' => 0, 'outcomes' => [], 'first_recorded_at' => null, 'recent' => []]);
});

test('a reviewed submission earns points once, can exceed 100 and is recalculated from configurable weights', function () {
    Notification::fake();
    $user = User::factory()->create();
    $moderator = User::factory()->create();
    $space = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);
    $space->fill(['status' => ParkingStatus::APPROVED])->saveReviewedBy($moderator);
    $space->saveReviewedBy($moderator);

    expect(communityPointsFor($user)['score'])->toBe(6);
    expect(communityPointsFor($user)['reviewed'])->toBe(1);
    $values = config('community-points.contribution_values');
    $values['submission.approved'] = 200;
    config(['community-points.contribution_values' => $values]);
    expect(communityPointsFor($user)['score'])->toBe(120);

    $space->fill(['status' => ParkingStatus::REJECTED])->saveReviewedBy($moderator, RejectionReason::DUPLICATE);
    expect(communityPointsFor($user)['score'])->toBe(0);
    expect(communityPointsFor($user)['reviewed'])->toBe(1);
});

test('approved contributions have the same value when a moderator makes corrections', function () {
    Notification::fake();
    $user = User::factory()->create();
    $moderator = User::factory()->create();
    $space = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);
    $space->fill(['status' => ParkingStatus::APPROVED, 'description' => 'Corrected by moderator'])->saveReviewedBy($moderator);
    $proposal = ParkingSpaceImprovement::factory()->for($user)->create(['submitted' => ['description' => 'Proposed']]);
    app(ParkingSpaceImprovements::class)->approve($proposal, $moderator, ['description' => 'Corrected']);

    expect(communityPointsFor($user)['score'])->toBe(10);
    expect(array_column(communityPointsFor($user)['outcomes'], 'outcome'))->toBe(['improvement.approved', 'submission.approved']);
});

test('useful improvements earn community points and bulk spam rejections subtract only once', function () {
    Notification::fake();
    $user = User::factory()->create();
    $moderator = User::factory()->create();
    $proposal = ParkingSpaceImprovement::factory()->for($user)->create(['submitted' => ['description' => 'Useful detail']]);
    app(ParkingSpaceImprovements::class)->approve($proposal, $moderator, $proposal->submitted);
    expect(communityPointsFor($user)['score'])->toBe(3);

    $spam = ParkingSpaceImprovement::factory()->for($user)->create();
    $service = app(ParkingSpaceImprovements::class);
    $service->reject([$spam->id], $moderator, ImprovementRejectionReason::SPAM, null);
    $service->reject([$spam->id], $moderator, ImprovementRejectionReason::SPAM, null);
    expect(communityPointsFor($user)['score'])->toBe(2);
    expect(communityPointsFor($user)['reviewed'])->toBe(2);
});

test('rejection reasons distinguish good faith exclusions from established errors', function (RejectionReason $reason, string $outcome, int $score) {
    Notification::fake();
    $user = User::factory()->create();
    $moderator = User::factory()->create();
    $approved = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);
    $approved->fill(['status' => ParkingStatus::APPROVED])->saveReviewedBy($moderator);
    $rejected = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);
    $rejected->fill(['status' => ParkingStatus::REJECTED])->saveReviewedBy($moderator, $reason, 'Do not retain this personal note');

    expect(communityPointsFor($user)['score'])->toBe($score);
    $this->assertDatabaseHas('community_point_events', ['subject_id' => $rejected->id, 'reason' => $reason->value, 'outcome' => $outcome]);
    expect(DB::table('community_point_events')->first())->not->toHaveKey('note');
})->with([
    [RejectionReason::DUPLICATE, 'neutral', 6],
    [RejectionReason::INSUFFICIENT_INFORMATION, 'neutral', 6],
    [RejectionReason::WRONG_LOCATION, 'neutral', 6],
    [RejectionReason::OTHER, 'neutral', 6],
    [RejectionReason::NOT_A_DISABLED_BAY, 'incorrect', 5],
    [RejectionReason::SPAM, 'spam', 3],
]);

test('a disappearance rewards each reporter and preserves earned value after the place and its reviews are deleted', function () {
    Notification::fake();
    $owner = User::factory()->create();
    $reporter = User::factory()->create();
    $moderator = User::factory()->create();
    $space = ParkingSpace::factory()->for($owner)->create(['status' => ParkingStatus::PENDING]);
    $space->fill(['status' => ParkingStatus::APPROVED])->saveReviewedBy($moderator);
    $report = ParkingPlaceReport::factory()->for($reporter)->create(['parking_space_id' => $space->id]);
    app(ParkingPlaceModeration::class)->remove($space, $moderator, RemovalReason::NO_LONGER_EXISTS, null);

    $this->assertDatabaseMissing('parking_place_reports', ['id' => $report->id]);
    expect(communityPointsFor($owner)['score'])->toBe(6);
    expect(communityPointsFor($reporter)['score'])->toBe(2);
    expect(communityPointsFor($reporter)['outcomes'][0]['reason'])->toBe('no_longer_exists');
});

test('uncertain kept reports remain neutral and repeated resolution does not double count', function () {
    Notification::fake();
    $report = ParkingPlaceReport::factory()->create();
    $moderator = User::factory()->create();
    $service = app(ParkingPlaceModeration::class);
    $service->keep($report->parkingSpace, $moderator);
    $service->keep($report->parkingSpace, $moderator);
    expect(communityPointsFor($report->user)['score'])->toBe(0);
    expect(communityPointsFor($report->user)['reviewed'])->toBe(1);
});

test('outcomes roll back with the moderation transaction', function () {
    Notification::fake();
    $user = User::factory()->create();
    $moderator = User::factory()->create();
    $space = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);
    try {
        DB::transaction(function () use ($space, $moderator) {
            $space->fill(['status' => ParkingStatus::APPROVED])->saveReviewedBy($moderator);
            throw new RuntimeException('Rollback');
        });
    } catch (RuntimeException) {
        expect($space->fresh()->status)->toBe(ParkingStatus::PENDING);
    }
    expect(communityPointsFor($user)['reviewed'])->toBe(0);
});

test('account deletion removes the personal ledger while deleting a reviewer only anonymizes their decisions', function () {
    Notification::fake();
    $user = User::factory()->create();
    $moderator = User::factory()->create();
    $space = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);
    $space->fill(['status' => ParkingStatus::APPROVED])->saveReviewedBy($moderator);
    $moderator->delete();
    expect(communityPointsFor($user)['score'])->toBe(6);
    $this->assertDatabaseHas('community_point_events', ['user_id' => $user->id, 'reviewed_by' => null]);
    $user->delete();
    $this->assertDatabaseCount('community_point_events', 0);
    expect($space->fresh()->user_id)->toBeNull();
});

test('only moderators receive community points context and user serialization stays private', function () {
    Notification::fake();
    $user = User::factory()->create();
    $moderator = tap(User::factory()->create())->assignRole(UserRole::MODERATOR);
    $approved = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);
    $approved->fill(['status' => ParkingStatus::APPROVED])->saveReviewedBy($moderator);
    $pending = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);

    $this->actingAs($moderator)->get(route('app.moderation.submissions.show', $pending))
        ->assertInertia(fn (Assert $page) => $page->where('selected.contributor.community_points.score', 6)
            ->where('selected.contributor.community_points.reviewed', 1)
            ->missing('selected.contributor.community_points.weights'));
    $this->actingAs($user)->get(route('app.moderation.index'))->assertForbidden();
    $this->get(route('dashboard'))->assertDontSee('community_points');
    $this->getJson(route('map.parking-spaces.show', $approved->id))
        ->assertOk()->assertJsonMissingPath('community_points')->assertJsonMissingPath('moderator_corrected');
    expect($user->fresh()->toArray())->not->toHaveKeys(['community_points', 'community_points_score', 'community_point_events']);
});

test('corrections saved separately do not penalize a later approval', function () {
    Notification::fake();
    $user = User::factory()->create();
    $moderator = User::factory()->create();
    $space = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);
    $space->fill(['description' => 'Corrected before approval'])->saveReviewedBy($moderator);
    expect(communityPointsFor($user)['reviewed'])->toBe(0);
    $space->fresh()->fill(['status' => ParkingStatus::APPROVED])->saveReviewedBy($moderator);
    expect(communityPointsFor($user)['score'])->toBe(6);
    expect($space->fresh()->toArray())->not->toHaveKey('moderator_corrected');

    $space->fresh()->fill(['status' => ParkingStatus::PENDING])->saveReviewedBy($moderator);
    expect(communityPointsFor($user)['score'])->toBe(0);
});

test('report community points is shown to the report moderator alongside recent decisions', function () {
    Notification::fake();
    $user = User::factory()->create();
    $moderator = tap(User::factory()->create())->assignRole(UserRole::MODERATOR);
    $first = ParkingPlaceReport::factory()->for($user)->create();
    app(ParkingPlaceModeration::class)->remove($first->parkingSpace, $moderator, RemovalReason::NO_LONGER_EXISTS, null);
    $next = ParkingPlaceReport::factory()->for($user)->create();
    $this->actingAs($moderator)->get(route('app.moderation.reports.show', ['source' => 'community', 'id' => $next->parking_space_id]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('selected.details.reports.0.community_points.score', 2)
            ->where('selected.details.reports.0.community_points.recent.0.outcome', 'report.confirmed'));
});

test('recent decisions are bounded per contributor and retain unambiguous UTC timestamps', function () {
    Notification::fake();
    $this->travelTo('2026-10-21 09:00:00');
    $user = User::factory()->create();
    $other = User::factory()->create();
    $moderator = User::factory()->create();
    foreach (range(1, 6) as $index) {
        $space = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);
        $space->fill(['status' => ParkingStatus::APPROVED])->saveReviewedBy($moderator);
        $this->travel(1)->minutes();
    }
    $profile = communityPointsFor($user);
    expect($profile['score'])->toBe(48);
    expect($profile['reviewed'])->toBe(6);
    expect($profile['recent'])->toHaveCount(5);
    expect($profile['first_recorded_at'])->toBe('2026-10-21T09:00:00.000000Z');
    expect($profile['recent'][0]['decided_at'])->toBe('2026-10-21T09:05:00.000000Z');
    expect(communityPointsFor($other)['recent'])->toBe([]);
});

test('municipal hiding preserves the reporters community points without rewarding unrelated duplicate removal', function () {
    Notification::fake();
    $report = ParkingPlaceReport::factory()->municipal()->create();
    $moderator = User::factory()->create();
    app(ParkingPlaceModeration::class)->remove($report->parkingMunicipal, $moderator, RemovalReason::DUPLICATE, null);
    expect(communityPointsFor($report->user)['score'])->toBe(0);
    expect(communityPointsFor($report->user)['outcomes'][0]['reason'])->toBe('duplicate');
    expect($report->parkingMunicipal->fresh()->visibility)->toBeFalse();
});

test('community points balances contribution value quality and evidence volume', function (int $approved, int $incorrect, int $spam, int $neutral, int $expected) {
    $user = User::factory()->create();
    $moderator = User::factory()->create();
    $service = app(CommunityPoints::class);
    $index = 0;
    foreach (['submission.approved' => $approved, 'incorrect' => $incorrect, 'spam' => $spam, 'neutral' => $neutral] as $outcome => $count) {
        for ($iteration = 0; $iteration < $count; $iteration++) {
            $service->record($user->id, $moderator->id, 'submission', (string) ++$index, $outcome);
        }
    }

    expect(communityPointsFor($user)['score'])->toBe($expected);
})->with([
    'no history' => [0, 0, 0, 0, 0],
    'negative evidence alone never awards community points' => [0, 1, 1, 0, 0],
    'one approval is not treated as a perfect track record' => [1, 0, 0, 0, 6],
    'two approvals' => [2, 0, 0, 0, 13],
    'longer useful history' => [20, 0, 0, 0, 183],
    'an isolated error in a longer good history' => [20, 1, 0, 0, 176],
    'repeated errors reduce the quality adjustment' => [20, 5, 0, 0, 152],
    'spam weighs more heavily than ordinary errors' => [20, 0, 5, 0, 90],
    'many approvals do not erase a poor correctness record' => [10, 10, 0, 0, 50],
    'good faith exclusions do not dilute established quality' => [2, 0, 0, 20, 13],
    'community points can grow well beyond 100' => [110, 0, 0, 0, 1081],
]);

test('model recalibration changes evidence sensitivity without changing retained decisions', function () {
    $user = User::factory()->create();
    $moderator = User::factory()->create();
    $service = app(CommunityPoints::class);
    $service->record($user->id, $moderator->id, 'submission', 'first', 'submission.approved');
    $service->record($user->id, $moderator->id, 'submission', 'second', 'spam');
    expect(communityPointsFor($user)['score'])->toBe(3);

    config(['community-points.negative_evidence.spam' => 1]);
    expect(communityPointsFor($user)['score'])->toBe(5);
    $service->record($user->id, $moderator->id, 'submission', 'third', 'submission.approved');
    expect(communityPointsFor($user)['score'])->toBe(11);
    config(['community-points.prior_evidence' => 1]);
    expect(communityPointsFor($user)['score'])->toBe(12);
    expect(communityPointsFor($user)['reviewed'])->toBe(3);
});

test('decision order and inactivity do not change accumulated community points', function () {
    $this->travelTo('2026-10-21 09:00:00');
    $first = User::factory()->create();
    $second = User::factory()->create();
    $moderator = User::factory()->create();
    $service = app(CommunityPoints::class);
    $outcomes = ['submission.approved', 'incorrect', 'submission.approved', 'neutral', 'spam'];
    foreach ([$first->id => $outcomes, $second->id => array_reverse($outcomes)] as $userId => $decisions) {
        foreach ($decisions as $index => $outcome) {
            $service->record($userId, $moderator->id, 'submission', "{$userId}:{$index}", $outcome);
        }
    }
    expect(communityPointsFor($first)['score'])->toBe(7);
    expect(communityPointsFor($second)['score'])->toBe(7);
    $this->travel(2)->years();
    expect(communityPointsFor($first)['score'])->toBe(7);
});
