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
        // Account-level key (Bunny dashboard > Account Settings > API Key).
        // Used by BunnyBandwidthSyncService to download the shared pull
        // zone's raw CDN logs and attribute real bytes served back to each
        // tenant via their videos' GUIDs. Without it, bandwidth stays an
        // estimate (size x views).
        'account_api_key' => env('BUNNY_ACCOUNT_API_KEY'),
    ],

    'vimeo' => [
        'access_token' => env('VIMEO_ACCESS_TOKEN'),
    ],
];
