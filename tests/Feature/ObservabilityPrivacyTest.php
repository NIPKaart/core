<?php

use App\Models\User;
use App\Support\ObservabilityPrivacy;
use Laravel\Nightwatch\Facades\Nightwatch;
use Laravel\Nightwatch\Records\OutgoingRequest;
use Laravel\Nightwatch\Records\Request;
use Symfony\Component\HttpFoundation\FileBag;
use Symfony\Component\HttpFoundation\HeaderBag;
use Symfony\Component\HttpFoundation\InputBag;

test('monitoring knows users by id only and keeps locations, searches and keys out of addresses', function () {
    $recorder = new class
    {
        /** @var array<string, callable> */
        public array $callbacks = [];

        public function __call(string $method, array $arguments): void
        {
            $this->callbacks[$method] = $arguments[0];
        }
    };
    Nightwatch::swap($recorder);

    ObservabilityPrivacy::register();
    $callbacks = $recorder->callbacks;

    $request = new Request(
        method: 'GET', url: 'https://nipkaart.nl/map?place=community%3A42&at=52.38010%2C4.63720', routeName: 'location-map', routeMethods: ['GET'],
        routeDomain: '', routePath: 'map', routeAction: 'map', ip: '203.0.113.9', duration: 12, statusCode: 200, requestSize: 0,
        responseSize: 0, headers: new HeaderBag, payload: new InputBag, files: new FileBag,
    );
    ($callbacks['redactRequests'])($request);
    $outgoing = new OutgoingRequest('GET', 'https://api.geoapify.com/v1/geocode/search?text=Damrak%201&apiKey=secret', 80, 0, 512, 200);
    ($callbacks['redactOutgoingRequests'])($outgoing);

    expect(($callbacks['user'])(User::factory()->make(['name' => 'Jan Bakker', 'email' => 'jan@example.nl'])))->toBe([])
        ->and($request->ip)->toBe('')
        ->and($request->url)->toBe('https://nipkaart.nl/map')
        ->and($outgoing->url)->toBe('https://api.geoapify.com/v1/geocode/search');
});

test('an address without a query string stays as it is', function () {
    expect(ObservabilityPrivacy::withoutQuery('https://nipkaart.nl/app/parking-spaces'))->toBe('https://nipkaart.nl/app/parking-spaces')
        ->and(ObservabilityPrivacy::withoutQuery('https://nipkaart.nl/over#contact'))->toBe('https://nipkaart.nl/over');
});
