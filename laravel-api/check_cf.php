<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$accountId = config('video.cloudflare.account_id');
$apiToken = config('video.cloudflare.api_token');

$response = \Illuminate\Support\Facades\Http::withToken($apiToken)
    ->withOptions(['verify' => false])
    ->get('https://api.cloudflare.com/client/v4/accounts/' . $accountId . '/stream/febc63e8dfc8155ccf10e25c01e02755');

echo json_encode($response->json(), JSON_PRETTY_PRINT) . "\n";
