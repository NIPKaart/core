<?php

namespace App\Support;

use Laravel\Nightwatch\Facades\Nightwatch;
use Laravel\Nightwatch\Records\OutgoingRequest;
use Laravel\Nightwatch\Records\Request;

/**
 * What Nightwatch may know about the people using NIPKaart: as little as monitoring needs (#1261).
 *
 * Errors, jobs and slow requests are worth reporting; who someone is, where they are and what they searched for are not.
 * Users are reported by id only, never by name or email. Request IP addresses are dropped. Query strings are stripped
 * from incoming and outgoing URLs, because they hold destination searches, map coordinates and provider API keys.
 * Request payloads are not captured (Nightwatch's default) and mail is only counted per recipient type.
 */
final class ObservabilityPrivacy
{
    public static function register(): void
    {
        Nightwatch::user(fn (): array => []);
        Nightwatch::redactRequests(function (Request $request): void {
            $request->ip = '';
            $request->url = self::withoutQuery($request->url);
        });
        Nightwatch::redactOutgoingRequests(function (OutgoingRequest $request): void {
            $request->url = self::withoutQuery($request->url);
        });
    }

    /**
     * The address up to its path: no query string or fragment.
     */
    public static function withoutQuery(string $url): string
    {
        return preg_replace('/[?#].*$/s', '', $url) ?? '';
    }
}
