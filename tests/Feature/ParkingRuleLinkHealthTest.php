<?php

use App\Enums\RuleLinkStatus;
use App\Enums\UserRole;
use App\Models\ParkingRule;
use App\Models\User;
use App\Services\ParkingRuleLinkChecker;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Http::preventStrayRequests();
    $this->rule = ParkingRule::factory()->create(['url' => 'https://www.haarlem.nl/regels']);
});

function checkRule(ParkingRule $rule): RuleLinkStatus
{
    return app(ParkingRuleLinkChecker::class)->check($rule);
}

test('a link that opens is healthy, and the check does not count as a change to the source', function () {
    $this->travelTo('2026-10-01 09:00:00');
    $this->rule->touch();
    $this->travelTo('2026-10-05 04:15:00');
    Http::fake(['https://www.haarlem.nl/regels' => Http::response('<html></html>', 200)]);

    expect(checkRule($this->rule))->toBe(RuleLinkStatus::OK)
        ->and($this->rule->fresh())
        ->link_status->toBe(RuleLinkStatus::OK)
        ->link_http_status->toBe(200)
        ->link_final_url->toBeNull()
        ->link_checked_at->toDateTimeString()->toBe('2026-10-05 04:15:00')
        ->updated_at->toDateTimeString()->toBe('2026-10-01 09:00:00');
});

test('redirects are followed to the final address, but the stored address never changes', function () {
    Http::fake([
        'https://www.haarlem.nl/regels' => Http::response('', 301, ['Location' => '/parkeren/regels']),
        'https://www.haarlem.nl/parkeren/regels' => Http::response('', 302, ['Location' => 'https://haarlem.nl/parkeren']),
        'https://haarlem.nl/parkeren' => Http::response('ok', 200),
    ]);

    expect(checkRule($this->rule))->toBe(RuleLinkStatus::REDIRECTED)
        ->and($this->rule->fresh())
        ->url->toBe('https://www.haarlem.nl/regels')
        ->link_final_url->toBe('https://haarlem.nl/parkeren');
});

test('an error status breaks the link and remembers since when it fails until it works again', function () {
    Http::fake(['https://www.haarlem.nl/regels' => Http::sequence()->push('', 404)->push('', 503)->push('ok', 200)]);

    $this->travelTo('2026-10-03 04:15:00');
    expect(checkRule($this->rule))->toBe(RuleLinkStatus::BROKEN)
        ->and($this->rule->fresh()->link_http_status)->toBe(404);

    $this->travelTo('2026-10-04 04:15:00');
    checkRule($this->rule);
    expect($this->rule->fresh())
        ->link_http_status->toBe(503)
        ->link_failing_since->toDateTimeString()->toBe('2026-10-03 04:15:00');

    checkRule($this->rule);
    expect($this->rule->fresh())->link_status->toBe(RuleLinkStatus::OK)->link_failing_since->toBeNull();
});

test('timeouts, unknown domains and redirect loops break the link with a reason', function (Closure $respond, string $reason) {
    Http::fake(['*' => $respond]);

    expect(checkRule($this->rule))->toBe(RuleLinkStatus::BROKEN)
        ->and($this->rule->fresh()->link_error)->toBe($reason);
})->with([
    'timeout' => [fn () => fn () => throw new ConnectionException('cURL error 28: Operation timed out after 10001 milliseconds'), 'timeout'],
    'unknown domain' => [fn () => fn () => throw new ConnectionException('cURL error 6: Could not resolve host: www.haarlem.nl'), 'dns'],
    'redirect loop' => [fn () => fn () => Http::response('', 302, ['Location' => 'https://www.haarlem.nl/regels']), 'too_many_redirects'],
]);

test('a new address starts unchecked', function () {
    Http::fake(['*' => Http::response('', 404)]);
    checkRule($this->rule);

    $this->rule->update(['url' => 'https://www.haarlem.nl/nieuw']);

    expect($this->rule->fresh())->link_status->toBeNull()->link_checked_at->toBeNull()->link_failing_since->toBeNull();
});

test('the daily command checks every source and is scheduled for production', function () {
    ParkingRule::factory()->create(['url' => 'https://www.zwolle.nl/regels']);
    Http::fake(['https://www.haarlem.nl/*' => Http::response('ok', 200), 'https://www.zwolle.nl/*' => Http::response('', 500)]);

    $this->artisan('nipkaart:check-rule-links')
        ->expectsOutput('Checked 2 links: 1 ok, 0 redirected, 1 broken.')
        ->assertSuccessful();

    $event = collect(app(Schedule::class)->events())->first(fn ($event) => str_contains($event->command, 'nipkaart:check-rule-links'));
    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('15 4 * * *')
        ->and($event->environments)->toBe(['production']);
});

test('admins see broken links and can check one again', function () {
    Http::fake(['*' => Http::response('', 404)]);
    $admin = tap(User::factory()->create())->assignRole(UserRole::ADMIN);
    $this->actingAs($admin);

    $this->post(route('app.parking-rules.check', $this->rule))->assertRedirect(route('app.parking-rules.index'));

    $this->get(route('app.parking-rules.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('brokenLinks', 1)
            ->where('rules.data.0.link_status', 'broken')
            ->where('rules.data.0.link_http_status', 404));
});

test('checking a link needs the right to edit sources', function () {
    $this->actingAs(User::factory()->create())
        ->post(route('app.parking-rules.check', $this->rule))
        ->assertForbidden();

    Http::assertNothingSent();
});
