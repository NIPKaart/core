<?php

use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingStatus;
use App\Enums\UserRole;
use App\Models\Favorite;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceConfirmation;
use App\Models\ParkingSpaceReview;
use App\Models\User;
use App\Models\UserSuspension;
use Illuminate\Support\Str;

function communityRequest(string $action, ParkingSpace $space): array
{
    return match ($action) {
        'open add form' => ['get', route('location-map.add'), []],
        'submit a place' => ['post', route('location-map.store'), []],
        'confirm a place' => ['post', route('app.parking-spaces.confirm', $space), ['status' => ParkingConfirmationStatus::CONFIRMED->value]],
    };
}

describe('community eligibility', function () {
    test('guests are sent to sign in before any community action', function (string $action) {
        [$method, $uri, $data] = communityRequest($action, ParkingSpace::factory()->create());

        $this->{$method}($uri, $data)->assertRedirect(route('login'));
    })->with(['open add form', 'submit a place', 'confirm a place']);

    test('unverified accounts are sent to verify their email first', function (string $action) {
        [$method, $uri, $data] = communityRequest($action, ParkingSpace::factory()->create());

        $this->actingAs(User::factory()->unverified()->create())->{$method}($uri, $data)
            ->assertRedirect(route('verification.notice'));
    })->with(['open add form', 'submit a place', 'confirm a place']);

    test('suspended accounts are signed out instead of contributing', function (string $action) {
        $space = ParkingSpace::factory()->create();
        [$method, $uri, $data] = communityRequest($action, $space);

        $this->actingAs(User::factory()->create(['suspended_at' => now()]))->{$method}($uri, $data)
            ->assertRedirect(route('login'));

        $this->assertGuest();
        expect(ParkingSpaceConfirmation::count())->toBe(0);
    })->with(['open add form', 'submit a place', 'confirm a place']);

    test('verified active accounts may contribute', function () {
        $user = User::factory()->create();

        $this->actingAs($user)->get(route('location-map.add'))->assertOk();
        expect($user->can('contribute'))->toBeTrue()
            ->and(User::factory()->unverified()->create()->can('contribute'))->toBeFalse()
            ->and(User::factory()->create(['suspended_at' => now()])->can('contribute'))->toBeFalse();
    });
});

describe('suspension', function () {
    beforeEach(function () {
        $this->admin = tap(User::factory()->create())->assignRole(UserRole::ADMIN);
    });

    test('suspending requires a reason', function () {
        $user = User::factory()->create();

        $this->actingAs($this->admin)->put(route('app.users.suspend', $user), ['reason' => ''])
            ->assertSessionHasErrors('reason');

        expect($user->fresh()->suspended_at)->toBeNull()
            ->and($user->suspensions()->exists())->toBeFalse();
    });

    test('suspending and lifting are recorded with who acted and why', function () {
        $user = User::factory()->create();

        $this->actingAs($this->admin)->put(route('app.users.suspend', $user), ['reason' => 'Repeated spam submissions']);
        $suspension = $user->suspensions()->sole();
        expect($user->fresh()->suspended_at)->not->toBeNull()
            ->and($suspension)->suspended_by->toBe($this->admin->id)->reason->toBe('Repeated spam submissions')->lifted_at->toBeNull();

        $this->put(route('app.users.suspend', $user));
        expect($user->fresh()->suspended_at)->toBeNull()
            ->and($suspension->fresh())->lifted_by->toBe($this->admin->id)->lifted_at->not->toBeNull();

        $this->put(route('app.users.suspend', $user), ['reason' => 'Spam again']);
        expect($user->suspensions()->count())->toBe(2)
            ->and($user->fresh()->activeSuspension->reason)->toBe('Spam again');
    });

    test('suspension leaves pending contributions pending', function () {
        $user = User::factory()->create();
        $space = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);

        $this->actingAs($this->admin)->put(route('app.users.suspend', $user), ['reason' => 'Abuse']);

        expect($space->fresh()->status)->toBe(ParkingStatus::PENDING);
    });
});

describe('account deletion', function () {
    test('removes personal and unpublished data and keeps accepted places anonymously', function (string $deletedBy) {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $pending = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::PENDING]);
        $rejected = tap(ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::REJECTED]))->delete();
        $approved = ParkingSpace::factory()->for($user)->create(['status' => ParkingStatus::APPROVED, 'ip_address' => '203.0.113.7']);
        $othersPlace = ParkingSpace::factory()->for($other)->create(['status' => ParkingStatus::APPROVED]);
        $pendingReview = ParkingSpaceReview::factory()->for($pending)->create();
        $favoriteOfPending = Favorite::factory()->for($other)->for($pending, 'favoritable')->create();
        $favoriteOfApproved = Favorite::factory()->for($other)->for($approved, 'favoritable')->create();
        $ownFavorite = Favorite::factory()->for($user)->for($othersPlace, 'favoritable')->create();
        $ownConfirmation = ParkingSpaceConfirmation::factory()->for($user)->for($othersPlace)->create();
        $user->notifications()->create(['id' => (string) Str::uuid(), 'type' => 'test', 'data' => []]);

        if ($deletedBy === 'user') {
            $this->actingAs($user)->delete(route('profile.destroy'), ['password' => 'password'])->assertRedirect(route('home'));
        } else {
            $this->actingAs(tap(User::factory()->create())->assignRole(UserRole::ADMIN))
                ->delete(route('app.users.destroy', $user))->assertRedirect(route('app.users.index'));
        }

        $this->assertModelMissing($user);
        expect(ParkingSpace::withTrashed()->whereKey([$pending->id, $rejected->id])->exists())->toBeFalse()
            ->and($approved->fresh())->user_id->toBeNull()->ip_address->toBeNull()->status->toBe(ParkingStatus::APPROVED)
            ->and($othersPlace->fresh()->user_id)->toBe($other->id);
        $this->assertModelMissing($pendingReview);
        $this->assertModelMissing($favoriteOfPending);
        $this->assertModelExists($favoriteOfApproved);
        $this->assertModelMissing($ownFavorite);
        $this->assertModelMissing($ownConfirmation);
        $this->assertDatabaseMissing('notifications', ['notifiable_id' => $user->id]);
    })->with(['user', 'administrator']);

    test('keeps suspension and review records of other users without the deleted administrator', function () {
        $admin = tap(User::factory()->create())->assignRole(UserRole::ADMIN);
        $suspension = UserSuspension::factory()->for($admin, 'suspender')->create();
        $review = ParkingSpaceReview::factory()->for($admin, 'reviewer')
            ->for(ParkingSpace::factory()->for(User::factory())->create())
            ->create();

        $admin->delete();

        expect($suspension->fresh()->suspended_by)->toBeNull()
            ->and($review->fresh()->reviewed_by)->toBeNull();
    });
});
