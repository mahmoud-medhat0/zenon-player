<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$tenant = App\Models\Tenant::first();
if ($tenant) {
    $tenant->update([
        'allowed_domains' => ['https://focus-dev.a2zenon.com']
    ]);
    echo "Tenant allowed_domains updated successfully!\n";
} else {
    echo "No tenants found!\n";
}
