<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

it('serves the public bio with localized content and metadata before JavaScript runs', function (string $locale, string $title, string $campaign) {
    $this->withUnencryptedCookie('locale', $locale)->get(route('bio'))
        ->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertSee('<title data-inertia="">'.$title.' - NIPKaart</title>', false)
        ->assertSee('property="og:image"', false)
        ->assertSee('rel="canonical" href="'.route('bio').'"', false)
        ->assertInertia(fn (Assert $page) => $page->component('frontend/bio')
            ->where('campaign.title', $campaign)
            ->where('campaign.route', 'location-map.add')
            ->where('campaign.image', '/assets/images/bio/community-parking.webp')
            ->where('links.0.route', 'garages')
            ->where('links.3.url', 'https://github.com/NIPKaart')
            ->count('links', 4)->count('socials', 0));

    $this->assertGuest();
    Http::assertNothingSent();
})->with([
    ['nl', 'Op pad met NIPKaart', 'Samen maken we de kaart completer.'],
    ['en', 'On your way with NIPKaart', 'Together, we make the map more complete.'],
]);

it('shows campaigns from the inclusive start until the exclusive end using timezone offsets', function (string $time, bool $visible) {
    config([
        'bio.campaigns.0.starts_at' => '2026-10-25T02:30:00+02:00',
        'bio.campaigns.0.ends_at' => '2026-10-25T02:30:00+01:00',
    ]);
    $this->travelTo(new DateTimeImmutable($time));

    $this->get(route('bio'))->assertInertia(fn (Assert $page) => $page
        ->where('campaign', fn ($campaign): bool => $visible ? $campaign['id'] === 'complete-the-map' : $campaign === null)
        ->count('links', $visible ? 4 : 5));
})->with([
    ['2026-10-25T00:29:59Z', false],
    ['2026-10-25T00:30:00Z', true],
    ['2026-10-25T01:29:59Z', true],
    ['2026-10-25T01:30:00Z', false],
]);

it('supports open ended schedules', function (?string $start, ?string $end) {
    config(['bio.campaigns.0.starts_at' => $start, 'bio.campaigns.0.ends_at' => $end]);
    $this->travelTo(new DateTimeImmutable('2026-10-23T12:00:00Z'));

    $this->get(route('bio'))->assertInertia(fn (Assert $page) => $page->where('campaign.id', 'complete-the-map'));
})->with([[null, null], ['2026-10-23T11:00:00Z', null], [null, '2026-10-23T13:00:00Z']]);

it('chooses one campaign by order then stable ID regardless of configuration order', function () {
    $campaign = config('bio.campaigns.0');
    config(['bio.campaigns' => [
        [...$campaign, 'id' => 'z-campaign', 'order' => 10],
        [...$campaign, 'id' => 'b-campaign', 'order' => 5],
        [...$campaign, 'id' => 'a-campaign', 'order' => 5],
    ]]);

    $this->get(route('bio'))->assertInertia(fn (Assert $page) => $page->where('campaign.id', 'a-campaign'));
});

it('omits disabled content and restores the contribution link without a campaign', function () {
    config(['bio.campaigns.0.enabled' => false, 'bio.links.2.enabled' => false]);

    $this->get(route('bio'))->assertInertia(fn (Assert $page) => $page->where('campaign', null)
        ->where('links.0.route', 'location-map.add')->where('links.1.route', 'garages')
        ->where('links.2.route', 'contact')->count('links', 4));
});

it('localizes configured social profiles and optional link notes', function () {
    config([
        'bio.links.1.note' => ['nl' => 'Bekijk de garages', 'en' => 'Explore the garages'],
        'bio.socials' => [[
            'id' => 'social', 'title' => ['nl' => 'Officieel profiel', 'en' => 'Official profile'],
            'url' => 'https://example.com/nipkaart', 'enabled' => true, 'order' => 10,
        ]],
    ]);

    $this->withUnencryptedCookie('locale', 'en')->get(route('bio'))->assertInertia(fn (Assert $page) => $page
        ->where('socials.0.title', 'Official profile')->where('socials.0.url', 'https://example.com/nipkaart')
        ->where('links.0.note', 'Explore the garages'));
});

it('validates the shipped bio configuration before publishing', function () {
    $this->artisan('nipkaart:validate-bio')->expectsOutputToContain('Bio configuration is valid.')->assertSuccessful();
});

it('rejects invalid content with the item ID and field', function (string $field, mixed $value, string $error) {
    config(["bio.campaigns.0.$field" => $value]);

    $status = Artisan::call('nipkaart:validate-bio');

    expect($status)->toBe(1);
    expect(Artisan::output())->toContain('['.($field === 'id' ? $value : 'complete-the-map').']', $error);
})->with([
    ['url', 'javascript:alert(1)', 'campaigns.0.url'],
    ['url', 'http://example.com', 'campaigns.0.url'],
    ['route', 'app.users.index', 'campaigns.0.route'],
    ['route', null, 'campaigns.0.route'],
    ['url', 'https://example.com', 'Choose exactly one'],
    ['id', 'garages', 'Item IDs must be unique'],
    ['title.nl', '', 'campaigns.0.title.nl'],
    ['action.en', '', 'campaigns.0.action.en'],
    ['note', ['nl' => 'Alleen Nederlands'], 'campaigns.0.note.en'],
    ['image', '/assets/images/not-found.webp', 'campaigns.0.image'],
    ['image', '/assets/images/../images/bio/community-parking.webp', 'campaigns.0.image'],
    ['image', 'https://example.com/image.webp', 'campaigns.0.image'],
    ['starts_at', '2026-10-23T12:00:00', 'explicit timezone offset'],
    ['starts_at', '2026-02-30T12:00:00Z', 'explicit timezone offset'],
    ['enabled', 'yes', 'campaigns.0.enabled'],
    ['order', 'first', 'campaigns.0.order'],
]);

it('rejects empty and reversed periods even on disabled campaigns', function (string $end) {
    config([
        'bio.campaigns.0.enabled' => false,
        'bio.campaigns.0.starts_at' => '2026-10-23T12:00:00Z',
        'bio.campaigns.0.ends_at' => $end,
    ]);

    $status = Artisan::call('nipkaart:validate-bio');

    expect($status)->toBe(1);
    expect(Artisan::output())->toContain('complete-the-map', 'The end must be after the start.');
})->with(['2026-10-23T12:00:00Z', '2026-10-23T11:00:00Z']);
