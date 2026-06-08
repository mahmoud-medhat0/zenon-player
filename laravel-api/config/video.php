<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Video Processing Backend
    |--------------------------------------------------------------------------
    |
    | This value determines which video processing backend will be used.
    | Supported: "local", "cloudflare"
    |
    */

    'processor' => env('VIDEO_PROCESSOR', 'local'),

    'cloudflare' => [
        'account_id' => env('CLOUDFLARE_ACCOUNT_ID'),
        'api_token' => env('CLOUDFLARE_API_TOKEN'),
    ],

    'bunny' => [
        'library_id' => env('BUNNY_LIBRARY_ID'),
        'api_key' => env('BUNNY_API_KEY'),
        'pull_zone' => env('BUNNY_PULL_ZONE'),
        'security_key' => env('BUNNY_SECURITY_KEY'),
    ],

    'vimeo' => [
        'access_token' => env('VIMEO_ACCESS_TOKEN'),
    ],
];
