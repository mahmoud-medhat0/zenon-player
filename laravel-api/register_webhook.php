<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$accountId = config('video.cloudflare.account_id');
$apiToken = config('video.cloudflare.api_token');

if (!$accountId || !$apiToken) {
    die("Missing Cloudflare config\n");
}

$response = \Illuminate\Support\Facades\Http::withToken($apiToken)
    ->withOptions(['verify' => false])
    ->put('https://api.cloudflare.com/client/v4/accounts/' . $accountId . '/stream/webhook', [
        'notificationUrl' => 'https://player.a2zenon.com/api/webhooks/cloudflare'
    ]);

$data = $response->json();
echo json_encode($data, JSON_PRETTY_PRINT) . "\n";

if ($response->successful()) {
    $secret = $data['result']['secret'] ?? null;
    if ($secret) {
        $envPath = __DIR__ . '/.env';
        $envContent = file_get_contents($envPath);
        
        if (strpos($envContent, 'CLOUDFLARE_WEBHOOK_SECRET=') !== false) {
            $envContent = preg_replace('/CLOUDFLARE_WEBHOOK_SECRET=.*/', 'CLOUDFLARE_WEBHOOK_SECRET=' . $secret, $envContent);
        } else {
            $envContent .= "\nCLOUDFLARE_WEBHOOK_SECRET=" . $secret . "\n";
        }
        
        file_put_contents($envPath, $envContent);
        echo "\nSuccess! Added secret to .env: " . $secret . "\n";
    }
}
