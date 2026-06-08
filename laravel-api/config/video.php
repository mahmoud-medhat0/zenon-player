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
];
