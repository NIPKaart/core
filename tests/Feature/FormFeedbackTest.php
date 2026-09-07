<?php

use App\Enums\ParkingOrientation;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\ParkingSpace;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;

// Exercise the actual web middleware and Inertia protocol, including partial reloads.
beforeEach(function () {
    Notification::fake();
    $this->withHeader('X-Inertia-Version', (string) app(HandleInertiaRequests::class)->version(request()));
    Route::middleware('web')->get('/_test/feedback', fn () => Inertia::render('welcome', ['marker' => true]));
});

test('flash feedback is delivered once outside page props even on a partial reload', function (string $level) {
    Route::middleware('web')->post('/_test/feedback', function () use ($level) {
        Inertia::flash($level, 'Feedback message');

        return redirect('/_test/feedback');
    });

    $this->post('/_test/feedback')->assertRedirect('/_test/feedback');
    $headers = [
        'X-Inertia' => 'true',
        'X-Inertia-Partial-Component' => 'welcome',
        'X-Inertia-Partial-Data' => 'marker',
    ];
    $this->get('/_test/feedback', $headers)->assertOk()
        ->assertJsonPath("flash.$level", 'Feedback message')
        ->assertJsonMissingPath('props.flash');
    $this->get('/_test/feedback', $headers)->assertOk()->assertJsonMissingPath('flash');

    // Identical feedback from a later action must not be suppressed.
    $this->post('/_test/feedback')->assertRedirect();
    $this->get('/_test/feedback', $headers)->assertJsonPath("flash.$level", 'Feedback message');
})->with(['success', 'error', 'warning', 'info']);

test('role form validation remains authoritative and success uses native flash', function () {
    $operator = User::factory()->create();
    $operator->givePermissionTo('role.create');
    $this->actingAs($operator)->from('/_test/feedback')
        ->post(route('app.roles.store'), ['name' => '', 'permissions' => []])
        ->assertSessionHasErrors('name');
    $this->get('/_test/feedback', ['X-Inertia' => 'true'])
        ->assertJsonStructure(['props' => ['errors' => ['name']]])
        ->assertJsonMissingPath('flash');

    $this->post(route('app.roles.store'), ['name' => 'feedback-editor', 'permissions' => [Permission::where('name', 'role.view')->sole()->id]])
        ->assertSessionHasNoErrors()->assertRedirect(route('app.roles.index'));
    $this->get('/_test/feedback', ['X-Inertia' => 'true'])
        ->assertJsonPath('flash.success', 'Role created successfully.')
        ->assertJsonPath('props.errors', [])
        ->assertJsonMissingPath('props.flash');
    expect(Role::where('name', 'feedback-editor')->exists())->toBeTrue();
});

test('parking editor can correct server errors and the server derives parking duration', function () {
    $space = ParkingSpace::factory()->create();
    $operator = User::factory()->create();
    $operator->givePermissionTo('parking-space.update');
    $payload = [
        'country_id' => $space->country_id,
        'province_id' => $space->province_id,
        'municipality_id' => $space->municipality_id,
        'postcode' => '1000 AA',
        'street' => 'Teststraat',
        'latitude' => 91,
        'longitude' => 4.9,
        'parking_hours' => 1,
        'parking_minutes' => 15,
        'orientation' => ParkingOrientation::all()[0],
        'window_times' => false,
        'status' => $space->status->value,
    ];
    $this->actingAs($operator)->from('/_test/feedback')
        ->put(route('app.parking-spaces.update', $space), $payload)
        ->assertSessionHasErrors('latitude');
    $this->get('/_test/feedback', ['X-Inertia' => 'true'])
        ->assertJsonStructure(['props' => ['errors' => ['latitude']]])
        ->assertJsonMissingPath('flash');

    $payload['latitude'] = 52.37;
    $this->put(route('app.parking-spaces.update', $space), $payload)
        ->assertSessionHasNoErrors()->assertRedirect(route('app.parking-spaces.index'));
    $this->get('/_test/feedback', ['X-Inertia' => 'true'])
        ->assertJsonPath('flash.success', __('parking_spaces.flash.updated'))
        ->assertJsonPath('props.errors', []);
    expect($space->fresh()->parking_time)->toBe(75);
});

test('self suspension is a validation error rather than a successful visit with an error toast', function () {
    $operator = User::factory()->create();
    $operator->givePermissionTo('user.update');
    $this->actingAs($operator)->from('/_test/feedback')
        ->put(route('app.users.suspend', $operator))
        ->assertSessionHasErrors('suspended_at');
    $this->get('/_test/feedback', ['X-Inertia' => 'true'])
        ->assertJsonStructure(['props' => ['errors' => ['suspended_at']]])
        ->assertJsonMissingPath('flash');
    expect($operator->fresh()->suspended_at)->toBeNull();
});
