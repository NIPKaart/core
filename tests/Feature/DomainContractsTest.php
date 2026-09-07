<?php

use App\Enums\ApiState;
use App\Enums\ParkingConfirmationStatus;
use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use App\Models\Country;
use App\Models\Favorite;
use App\Models\Municipality;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingRule;
use App\Models\ParkingSpace;
use App\Models\ParkingSpaceConfirmation;
use App\Models\Role;
use App\Models\User;
use App\Notifications\CommunitySpace\Deleted;
use App\Notifications\CommunitySpace\Restored;
use App\Notifications\CommunitySpace\StatusChanged;
use Database\Seeders\MunicipalityWithOffstreetSeeder;
use Database\Seeders\MunicipalityWithParkingSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

beforeEach(function () {
    Notification::fake();
});

test('community submission persists a UUID and redirects to the map', function () {
    $municipality = Municipality::factory()->create();
    $user = User::factory()->create();

    $this->actingAs($user)->post(route('location-map.store'), [
        'latitude' => 52.37,
        'longitude' => 4.9,
        'orientation' => ParkingOrientation::all()[0],
        'parking_hours' => null,
        'parking_minutes' => null,
        'message' => null,
        'window_times' => false,
        'nominatim' => json_encode([
            'country_code' => $municipality->country->code,
            'state' => $municipality->province->name,
            'city' => $municipality->name,
            'road' => 'Teststraat',
            'postcode' => '1000 AA',
        ]),
    ])->assertSessionHasNoErrors()->assertRedirect(route('location-map'));

    $space = $user->parkingSpaces()->sole();
    expect(Str::isUuid($space->id))->toBeTrue()
        ->and($space->status)->toBe(ParkingStatus::PENDING);
});

test('restoring a space authorizes its instance and preserves UUID notification links', function () {
    $space = ParkingSpace::factory()->create();
    $space->delete();
    Notification::fake();
    $operator = User::factory()->create();
    $operator->givePermissionTo('parking-space.restore');

    $this->actingAs($operator)->patch(route('app.parking-spaces.restore', $space->id))->assertRedirect();

    expect($space->fresh()->trashed())->toBeFalse();
    Notification::assertSentTo($space->user, Restored::class, function ($notification) use ($space) {
        return $notification->spaceId === $space->id
            && $notification->toDatabase($space->user)->data['url'] === route('app.parking-spaces.show', $space->id);
    });
});

test('permanent deletion sends exactly one owner notification', function () {
    $space = ParkingSpace::factory()->create();
    $owner = $space->user;
    $space->forceDelete();

    Notification::assertSentToTimes($owner, Deleted::class, 1);
});

test('unavailable favorites remain removable without resolving their target', function () {
    $user = User::factory()->create();
    $space = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
    $favorite = $user->favorites()->create([
        'favoritable_type' => $space->getMorphClass(),
        'favoritable_id' => $space->id,
    ]);
    $space->delete();

    $this->actingAs($user)->getJson(route('profile.favorites.list'))
        ->assertOk()
        ->assertJsonPath('favorites.0.favorite_id', $favorite->id)
        ->assertJsonPath('favorites.0.available', false)
        ->assertJsonPath('favorites.0.latitude', null);

    $this->delete(route('profile.favorites.destroy'), [
        'type' => 'parking_space',
        'id' => $space->id,
    ])->assertRedirect();
    $this->assertModelMissing($favorite);
});

test('favorite lists preserve visible records and conceal unavailable target details', function (string $model, array $visible, array $hidden, string $type) {
    $user = User::factory()->create();
    $space = $model::factory()->create($visible);
    $favorite = Favorite::factory()->for($user)->for($space, 'favoritable')->create();
    $this->actingAs($user)->getJson(route('profile.favorites.list'))
        ->assertOk()->assertJsonPath('favorites.0.id', $space->id)
        ->assertJsonPath('favorites.0.type', $type)
        ->assertJsonPath('favorites.0.available', true);

    $space->forceFill($hidden)->save();
    $this->getJson(route('profile.favorites.list'))->assertOk()
        ->assertJsonPath('favorites.0.available', false)
        ->assertJsonPath('favorites.0.title', '')
        ->assertJsonPath('favorites.0.longitude', null);

    $space instanceof ParkingSpace ? $space->forceDelete() : $space->delete();
    $this->getJson(route('profile.favorites.list'))->assertOk()->assertJsonPath('favorites.0.available', false);
    $this->delete(route('profile.favorites.destroy'), ['favorite_id' => $favorite->id])->assertRedirect();
    $this->assertModelMissing($favorite);
})->with([
    'community' => [ParkingSpace::class, ['status' => ParkingStatus::APPROVED], ['status' => ParkingStatus::REJECTED], 'Community'],
    'municipal' => [ParkingMunicipal::class, ['visibility' => true], ['visibility' => false], 'Municipal'],
    'offstreet' => [ParkingOffstreet::class, ['visibility' => true], ['visibility' => false], 'Offstreet'],
]);

test('favorite writes are idempotent and cannot delete another users reference', function () {
    $user = User::factory()->create();
    $space = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
    $payload = ['type' => 'parking_space', 'id' => $space->id];
    $this->actingAs($user)->post(route('profile.favorites.store'), $payload)->assertRedirect();
    $this->post(route('profile.favorites.store'), $payload)->assertRedirect();
    expect($user->favorites()->count())->toBe(1);
    $other = Favorite::factory()->for($space, 'favoritable')->create();
    $this->delete(route('profile.favorites.destroy'), ['favorite_id' => $other->id])->assertNotFound();
    $this->assertModelExists($other);

    $space->update(['status' => ParkingStatus::PENDING]);
    $this->post(route('profile.favorites.store'), $payload)->assertNotFound();
    $this->postJson(route('profile.favorites.store'), ['type' => 'parking_space', 'id' => 'not-a-uuid'])->assertUnprocessable();
});

test('factories and inverse relationships preserve the geographic hierarchy and ownership', function () {
    $municipality = Municipality::factory()->create();
    $offstreet = ParkingOffstreet::factory()->for($municipality)->create();
    $rule = ParkingRule::factory()->for($municipality)->create();
    $favorite = Favorite::factory()->for($offstreet, 'favoritable')->create();
    $confirmation = ParkingSpaceConfirmation::factory()->create();
    $role = Role::factory()->create();

    expect($municipality->country->municipalities->modelKeys())->toContain($municipality->id)
        ->and($municipality->province->municipalities->modelKeys())->toContain($municipality->id)
        ->and($municipality->parkingOffstreets->modelKeys())->toBe([$offstreet->id])
        ->and($municipality->parkingRules->modelKeys())->toBe([$rule->id])
        ->and($favorite->user->favorites->modelKeys())->toBe([$favorite->id])
        ->and($favorite->favoritable->is($offstreet))->toBeTrue()
        ->and($confirmation->user->confirmations->modelKeys())->toBe([$confirmation->id])
        ->and($confirmation->parkingSpace->confirmations->modelKeys())->toBe([$confirmation->id])
        ->and($role->guard_name)->toBe('web');
});

test('casts preserve JSON enum and nullable quantity contracts', function () {
    $garage = ParkingOffstreet::factory()->create(['api_state' => ApiState::OK, 'free_space_long' => null, 'long_capacity' => null, 'visibility' => true]);
    $space = ParkingSpace::factory()->create(['parking_disc' => true, 'window_times' => false, 'parking_time' => null]);
    $municipal = ParkingMunicipal::factory()->create(['number' => 2, 'orientation' => null]);
    $rule = ParkingRule::factory()->nationwide()->create();
    expect($garage->fresh()->api_state)->toBe(ApiState::OK)
        ->and($garage->fresh()->toArray()['api_state'])->toBe('ok')
        ->and($garage->fresh()->toArray()['free_space_long'])->toBeNull()
        ->and($space->fresh()->parking_disc)->toBeTrue()
        ->and($space->fresh()->window_times)->toBeFalse()
        ->and($space->fresh()->parking_time)->toBeNull()
        ->and($municipal->fresh()->number)->toBe(2)
        ->and($municipal->fresh()->latitude)->toBeFloat()
        ->and($municipal->fresh()->orientation)->toBeNull()
        ->and($rule->fresh()->nationwide)->toBeTrue()
        ->and($rule->municipality_id)->toBeNull();

    $garage->api_state = null;
    $garage->save();
    expect($garage->fresh()->toArray()['api_state'])->toBeNull();
});

test('instance policy calls allow permitted operators and reject other users', function () {
    $operator = User::factory()->create();
    $role = Role::factory()->create();
    $rule = ParkingRule::factory()->create();
    $this->actingAs($operator)->get(route('app.roles.show', $role))->assertForbidden();
    $this->delete(route('app.roles.destroy', $role))->assertForbidden();
    $this->delete(route('app.parking-rules.destroy', $rule))->assertForbidden();
    $operator->givePermissionTo(['role.view', 'role.delete', 'parking-rule.delete']);
    $this->get(route('app.roles.show', $role))->assertOk();
    $this->delete(route('app.roles.destroy', $role))->assertRedirect();
    $this->delete(route('app.parking-rules.destroy', $rule))->assertRedirect();
    $this->assertModelMissing($role);
    $this->assertModelMissing($rule);
});

test('bulk status restore and force deletion emit the same model notifications as single actions', function () {
    $owner = User::factory()->create();
    $space = ParkingSpace::factory()->for($owner)->create(['status' => ParkingStatus::PENDING]);
    $operator = User::factory()->create();
    $this->actingAs($operator)->patch(route('app.parking-spaces.bulk.update'), ['ids' => [$space->id], 'status' => 'approved'])->assertForbidden();
    $operator->givePermissionTo(['parking-space.update', 'parking-space.restore', 'parking-space.force-delete']);
    $this->patch(route('app.parking-spaces.bulk.update'), ['ids' => [$space->id], 'status' => 'approved'])->assertRedirect();
    Notification::assertSentToTimes($owner, StatusChanged::class, 1);
    $space->refresh()->delete();
    Notification::fake();
    $this->patch(route('app.parking-spaces.bulk.restore'), ['ids' => [$space->id]])->assertRedirect();
    Notification::assertSentToTimes($owner, Restored::class, 1);
    $space->refresh()->delete();
    Notification::fake();
    $this->delete(route('app.parking-spaces.bulk.force-delete'), ['ids' => [$space->id]])->assertRedirect();
    Notification::assertSentToTimes($owner, Deleted::class, 1);
    $this->assertModelMissing($space);
});

test('confirmations retain the daily rule and bulk deletion cannot cross the route parent', function () {
    $this->travelTo(now()->startOfDay()->addHours(12));
    $user = User::factory()->create();
    $space = ParkingSpace::factory()->create(['status' => ParkingStatus::APPROVED]);
    $this->actingAs($user)->post(route('app.parking-spaces.confirm', $space), ['status' => ParkingConfirmationStatus::CONFIRMED->value])->assertSessionHasNoErrors();
    $this->post(route('app.parking-spaces.confirm', $space), ['status' => ParkingConfirmationStatus::CONFIRMED->value])->assertSessionHasErrors('general');
    expect($space->confirmations()->count())->toBe(1);
    $this->travel(1)->days();
    $this->post(route('app.parking-spaces.confirm', $space), ['status' => ParkingConfirmationStatus::CONFIRMED->value])->assertSessionHasNoErrors();
    expect($space->confirmations()->count())->toBe(2);

    $other = ParkingSpaceConfirmation::factory()->create();
    $user->givePermissionTo('parking-space-confirmation.delete');
    $this->delete(route('app.parking-spaces.confirmations.bulk.destroy', $space), ['ids' => [$other->id]])->assertSessionHasErrors('ids.0');
    $this->assertModelExists($other);
    $this->delete(route('app.parking-spaces.confirmations.bulk.destroy', $space), ['ids' => $space->confirmations()->pluck('id')->all()])->assertSessionHasNoErrors();
    expect($space->confirmations()->count())->toBe(0);
});

test('national rule validation reports duplicates while updates can retain their own scope', function () {
    $operator = User::factory()->create();
    $operator->givePermissionTo(['parking-rule.create', 'parking-rule.update']);
    $rule = ParkingRule::factory()->nationwide()->create();
    $payload = ['country_id' => $rule->country_id, 'nationwide' => true, 'url' => 'https://example.com/rules'];
    $this->actingAs($operator)->post(route('app.parking-rules.store'), $payload)->assertSessionHasErrors('country_id');
    $this->put(route('app.parking-rules.update', $rule), $payload)->assertSessionHasNoErrors()->assertRedirect();
    expect($rule->fresh()->url)->toBe($payload['url']);
});

test('database constraints reject ambiguous rules and cross-country parking references', function () {
    $rule = ParkingRule::factory()->nationwide()->create();
    expect(fn () => DB::transaction(fn () => ParkingRule::factory()->nationwide()->create(['country_id' => $rule->country_id])))
        ->toThrow(QueryException::class);
    $municipality = Municipality::factory()->create();
    $otherCountry = Country::factory()->create();
    expect(fn () => DB::transaction(fn () => ParkingRule::factory()->for($municipality)->create(['nationwide' => true])))
        ->toThrow(QueryException::class);
    expect(fn () => DB::transaction(fn () => Municipality::factory()->create(['province_id' => $municipality->province_id, 'country_id' => $otherCountry->id])))
        ->toThrow(QueryException::class);
    foreach ([ParkingSpace::class, ParkingMunicipal::class, ParkingOffstreet::class] as $model) {
        expect(fn () => DB::transaction(fn () => $model::factory()->for($municipality)->create(['country_id' => $otherCountry->id])))
            ->toThrow(QueryException::class);
    }
    expect(fn () => DB::transaction(fn () => ParkingRule::factory()->for($municipality)->create(['country_id' => $otherCountry->id])))
        ->toThrow(QueryException::class);
});

test('integrity migration refuses existing duplicate rules without deleting data', function () {
    $migration = require database_path('migrations/2026_09_07_190000_enforce_domain_integrity.php');
    $migration->down();
    $country = Country::factory()->create();
    ParkingRule::factory()->nationwide()->count(2)->create(['country_id' => $country->id]);
    expect(fn () => DB::transaction(fn () => $migration->up()))->toThrow(QueryException::class);
    expect(ParkingRule::where('country_id', $country->id)->count())->toBe(2);
});

test('sample parking seeders supply valid geographic defaults without baseline reference seeds', function () {
    $this->seed(MunicipalityWithParkingSeeder::class);
    $this->seed(MunicipalityWithOffstreetSeeder::class);
    expect(ParkingMunicipal::count())->toBe(25)
        ->and(ParkingOffstreet::count())->toBe(15)
        ->and(Municipality::count())->toBe(5)
        ->and(Country::where('code', 'NL')->count())->toBe(1);
});

test('bulk visibility changes immediately remove public search results', function (string $model, string $route, string $permission) {
    $space = $model::factory()->create(['visibility' => true]);
    $operator = User::factory()->create();
    $operator->givePermissionTo($permission);
    $this->actingAs($operator)->post(route($route), ['ids' => [$space->id], 'visibility' => false])->assertRedirect();
    expect($space->fresh()->visibility)->toBeFalse();
    $this->getJson('/api/search?q='.urlencode($space->street ?? $space->name))->assertJsonPath('hits', []);
})->with([
    'municipal' => [ParkingMunicipal::class, 'app.parking-municipal.toggle-visibility', 'parking-municipal.update'],
    'offstreet' => [ParkingOffstreet::class, 'app.parking-offstreet.toggle-visibility', 'parking-offstreet.update'],
]);
