<?php

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Enums\UserRole;
use App\Models\DatasetImport;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingPlaceReport;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceReview;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionsTableSeeder;
use Illuminate\Support\Facades\Gate;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission as SpatiePermission;

function userWithRole(UserRole $role, array $attributes = []): User
{
    return tap(User::factory()->create($attributes))->assignRole($role);
}

/**
 * @return array<string, mixed>
 */
function reviewPayload(ParkingSpace $space): array
{
    return [
        'country_id' => $space->country_id,
        'province_id' => $space->province_id,
        'municipality_id' => $space->municipality_id,
        'postcode' => '1000 AA',
        'street' => 'Teststraat',
        'latitude' => 52.37,
        'longitude' => 4.9,
        'orientation' => ParkingOrientation::all()[0],
        'under_sign' => 'no',
    ];
}

test('moderation abilities are granted per role', function (string $ability, Closure $arguments, bool $admin, bool $moderator, bool $contributor) {
    $arguments = $arguments();

    expect(Gate::forUser(userWithRole(UserRole::ADMIN))->allows($ability, $arguments))->toBe($admin)
        ->and(Gate::forUser(userWithRole(UserRole::MODERATOR))->allows($ability, $arguments))->toBe($moderator)
        ->and(Gate::forUser(userWithRole(UserRole::USER))->allows($ability, $arguments))->toBe($contributor);
})->with([
    'review community parking' => ['update', fn () => ParkingSpace::factory()->create(), true, true, false],
    'delete community parking' => ['delete', fn () => ParkingSpace::factory()->create(), true, false, false],
    'remove confirmations' => ['parking-space-confirmation.delete', fn () => [], true, true, false],
    'view reports' => ['viewAny', fn () => ParkingPlaceReport::class, true, true, false],
    'handle reports' => ['resolve', fn () => ParkingPlaceReport::class, true, true, false],
    'hide municipal parking' => ['toggleVisibility', fn () => ParkingMunicipal::factory()->create(), true, true, false],
    'change offstreet parking' => ['update', fn () => ParkingOffstreet::factory()->create(), true, false, false],
    'view users' => ['viewAny', fn () => User::class, true, false, false],
    'view roles' => ['viewAny', fn () => Role::class, true, false, false],
    'operate dataset imports' => ['viewAny', fn () => DatasetImport::class, true, false, false],
]);

test('moderators can approve their own pending community submission', function () {
    $moderator = userWithRole(UserRole::MODERATOR);
    $space = ParkingSpace::factory()->for($moderator)->create(['status' => ParkingStatus::PENDING]);

    $this->actingAs($moderator)->put(route('app.parking-spaces.update', $space), [
        ...reviewPayload($space),
        'status' => ParkingStatus::APPROVED->value,
    ])->assertSessionHasNoErrors()->assertRedirect(route('app.parking-spaces.index'));

    expect($space->fresh()->status)->toBe(ParkingStatus::APPROVED)
        ->and($space->reviews()->sole())
        ->reviewed_by->toBe($moderator->id)
        ->from_status->toBe(ParkingStatus::PENDING)
        ->to_status->toBe(ParkingStatus::APPROVED);
});

test('editing a parking space without changing its status records no review', function () {
    $space = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);

    $this->actingAs(userWithRole(UserRole::ADMIN))->put(route('app.parking-spaces.update', $space), [
        ...reviewPayload($space),
        'status' => ParkingStatus::APPROVED->value,
    ])->assertSessionHasNoErrors();

    expect($space->reviews()->exists())->toBeFalse();
});

test('every status change adds to the review history', function () {
    $moderator = userWithRole(UserRole::MODERATOR);
    $admin = userWithRole(UserRole::ADMIN);
    $space = ParkingSpace::factory()->create(['status' => ParkingStatus::PENDING]);

    $this->actingAs($moderator)->put(route('app.parking-spaces.update', $space), [...reviewPayload($space), 'status' => ParkingStatus::REJECTED->value, 'rejection_reason' => 'duplicate']);
    $this->travel(1)->minute();
    $this->actingAs($admin)->put(route('app.parking-spaces.update', $space), [...reviewPayload($space), 'status' => ParkingStatus::APPROVED->value]);

    expect($space->reviews()->orderBy('reviewed_at')->get(['reviewed_by', 'to_status'])->toArray())->toBe([
        ['reviewed_by' => $moderator->id, 'to_status' => ParkingStatus::REJECTED->value],
        ['reviewed_by' => $admin->id, 'to_status' => ParkingStatus::APPROVED->value],
    ])->and($space->latestReview->reviewed_by)->toBe($admin->id);
});

test('bulk status changes are attributed to the moderator', function () {
    $moderator = userWithRole(UserRole::MODERATOR);
    $spaces = ParkingSpace::factory()->count(2)->create(['status' => ParkingStatus::PENDING]);

    $this->actingAs($moderator)->patch(route('app.parking-spaces.bulk.update'), [
        'ids' => $spaces->modelKeys(),
        'status' => ParkingStatus::REJECTED->value,
        'rejection_reason' => 'duplicate',
    ])->assertRedirect();

    $spaces->each(fn (ParkingSpace $space) => expect($space->reviews()->sole()->reviewed_by)->toBe($moderator->id));
});

test('deleting the reviewer account keeps the review without its identity', function () {
    $review = ParkingSpaceReview::factory()->create();

    $review->reviewer->delete();

    expect($review->fresh())->reviewed_by->toBeNull()->to_status->toBe(ParkingStatus::APPROVED);
});

test('the detail page shows the latest review', function () {
    $space = ParkingSpace::factory()->create();
    $review = ParkingSpaceReview::factory()->for($space)->create();

    $this->actingAs(userWithRole(UserRole::MODERATOR))->get(route('app.parking-spaces.show', $space))
        ->assertInertia(fn (Assert $page) => $page
            ->where('parkingSpace.latest_review.id', $review->id)
            ->where('parkingSpace.latest_review.reviewer.name', $review->reviewer->name));
});

test('moderators cannot open user administration', function () {
    $this->actingAs(userWithRole(UserRole::MODERATOR))
        ->get(route('app.users.index'))
        ->assertForbidden();
});

test('moderators cannot change offstreet visibility', function () {
    $space = ParkingOffstreet::factory()->create(['visibility' => true]);

    $this->actingAs(userWithRole(UserRole::MODERATOR))
        ->post(route('app.parking-offstreet.toggle-visibility'), ['ids' => [$space->id], 'visibility' => false])
        ->assertForbidden();

    expect($space->fresh()->visibility)->toBeTrue();
});

test('suspended accounts lose every ability their role grants', function (UserRole $role) {
    $user = userWithRole($role, ['suspended_at' => now()]);
    $space = ParkingSpace::factory()->create();

    expect(Gate::forUser($user)->allows('update', $space))->toBeFalse()
        ->and(Gate::forUser($user)->allows('parking-space.update'))->toBeFalse()
        ->and($user->can('parking-space.update'))->toBeFalse();
})->with([UserRole::MODERATOR, UserRole::ADMIN]);

test('reseeding revokes permissions removed from a configured role', function () {
    Role::findByName(UserRole::MODERATOR->value, 'web')->givePermissionTo('user.view_any');
    $moderator = userWithRole(UserRole::MODERATOR);

    $this->seed(PermissionsTableSeeder::class);

    expect($moderator->fresh()->can('user.view_any'))->toBeFalse()
        ->and($moderator->fresh()->can('parking-space.update'))->toBeTrue();
});

test('reseeding deletes permissions that are no longer declared in code', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(SpatiePermission::findOrCreate('role.create', 'web'));

    $this->seed(PermissionsTableSeeder::class);

    expect(SpatiePermission::where('name', 'role.create')->exists())->toBeFalse()
        ->and($user->fresh()->getAllPermissions())->toBeEmpty();
});
