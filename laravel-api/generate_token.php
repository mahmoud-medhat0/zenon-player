<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::first();
if (!$user) {
    echo "No users found!\n";
    exit;
}
$token = $user->createToken('Academy Access Token')->plainTextToken;
echo $token . "\n";
