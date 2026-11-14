<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'geoapify' => [
        'key' => env('GEOAPIFY_API_KEY'),
    ],

    /*
     * External geocoders, asked in this order: PDOK (Netherlands), Geoapify, then public Nominatim. See ADR 0012.
     */
    'geocoding' => [
        'providers' => array_values(array_filter(array_map('trim', explode(',', (string) env('GEOCODING_PROVIDERS', 'pdok,geoapify,nominatim'))))),
    ],

    /*
     * Aerial photo layers for checking locations, preferred in this order where they cover the country. See ADR 0014.
     */
    'imagery' => [
        'providers' => array_values(array_filter(array_map('trim', explode(',', (string) env('IMAGERY_PROVIDERS', 'pdok,google'))))),
    ],

    'parking_vision' => [
        'url' => env('PARKING_VISION_URL'),
        'key' => env('PARKING_VISION_API_KEY'),
    ],

    'nominatim' => [
        'enabled' => env('NOMINATIM_PUBLIC_ENABLED', true),
        'user_agent' => env('NOMINATIM_USER_AGENT', 'NIPKaart/1.0 (+https://nipkaart.nl)'),
    ],

];
