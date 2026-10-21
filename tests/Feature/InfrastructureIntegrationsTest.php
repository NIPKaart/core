<?php

use App\Enums\UserRole;
use App\Models\User;
use App\Notifications\CommunitySpace\DeletedByUser;
use Illuminate\Notifications\Events\BroadcastNotificationCreated;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Queue;
use Symfony\Component\Process\Process;

test('log viewer denies guests and non administrators', function (string $route) {
    expect(parse_url(route($route), PHP_URL_PATH))->toStartWith('/admin/logs');

    $this->getJson(route($route))->assertForbidden();
    $this->actingAs(User::factory()->create())->getJson(route($route))->assertForbidden();
})->with(['log-viewer.index', 'log-viewer.hosts', 'log-viewer.files']);

test('log viewer allows administrators but rejects suspended administrators', function () {
    $admin = User::factory()->create();
    $admin->assignRole(UserRole::ADMIN);
    $this->actingAs($admin)->get(route('log-viewer.index'))->assertOk()->assertSee('Log Viewer');
    $this->actingAs($admin)->getJson(route('log-viewer.hosts'))->assertOk();

    $admin->update(['suspended_at' => now()]);
    $this->getJson(route('log-viewer.hosts'))->assertForbidden();
});

test('the unused sanctum user endpoint is removed', function () {
    $this->getJson('/api/user')->assertNotFound();
});

test('encrypted backups refuse to run without an archive password', function () {
    config(['backup.backup.password' => null]);
    $this->artisan('backup:run-encrypted')
        ->expectsOutput('BACKUP_ARCHIVE_PASSWORD must be configured before database backups can run.')
        ->assertFailed();
});

test('backup tasks are due at their UTC times only in production', function (string $environment, ?string $enabled, bool $expected) {
    $process = new Process([PHP_BINARY, '-r', <<<'PHP'
        require 'vendor/autoload.php';
        $app = require 'bootstrap/app.php';
        $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
        \Illuminate\Support\Facades\Artisan::all();
        $schedule = $app->make(\Illuminate\Console\Scheduling\Schedule::class);
        $due = [];
        foreach (['backup:run-encrypted' => '01:30', 'backup:monitor' => '03:00', 'backup:clean' => '03:30'] as $command => $time) {
            \Illuminate\Support\Carbon::setTestNow("2026-10-19 {$time}:00 UTC");
            $due[] = collect($schedule->dueEvents($app))->contains(
                fn ($event) => str_contains($event->command ?? '', $command),
            );
        }
        echo json_encode($due);
        PHP,
    ], base_path(), ['APP_ENV' => $environment, 'BACKUP_ENABLED' => $enabled ?? false]);
    $process->mustRun();

    expect(json_decode($process->getOutput(), true))->toBe([$expected, $expected, $expected]);
})->with([
    'production default' => ['production', null, true],
    'production enabled' => ['production', 'true', true],
    'production disabled' => ['production', 'false', false],
    'local' => ['local', null, false],
    'testing' => ['testing', null, false],
    'staging' => ['staging', null, false],
]);

test('clockwork cannot collect or register routes in production even with debug overrides', function () {
    $process = new Process([PHP_BINARY, '-r', <<<'PHP'
        require 'vendor/autoload.php';
        $app = require 'bootstrap/app.php';
        $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
        echo json_encode([
            $app['clockwork.support']->isEnabled(),
            $app['clockwork.support']->isCollectingData(),
            collect($app['router']->getRoutes())->contains(fn ($route) => str_contains($route->uri(), '__clockwork')),
        ]);
        PHP,
    ], base_path(), [
        'APP_ENV' => 'production',
        'APP_DEBUG' => 'true',
        'CLOCKWORK_ENABLE' => 'true',
        'CLOCKWORK_COLLECT_DATA_ALWAYS' => 'true',
    ]);
    $process->mustRun();

    expect(json_decode($process->getOutput(), true))->toBe([false, false, false]);
});

test('notifications retain database and broadcast delivery on the private user channel', function () {
    Queue::fake();
    $user = User::factory()->create();
    $notification = new DeletedByUser('space-id', 'Test street', 'Owner', 123);

    expect($notification->via($user))->toBe(['database', 'broadcast']);
    $event = new BroadcastNotificationCreated($user, $notification);
    expect($event->broadcastOn()[0]->name)->toBe('private-App.Models.User.'.$user->id);
    $user->notify($notification);

    Queue::assertPushed(SendQueuedNotifications::class, 2);
});

test('search needs no external indexing commands', function () {
    expect(array_keys(Artisan::all()))->not->toContain('search:configure', 'scout:import');
});
