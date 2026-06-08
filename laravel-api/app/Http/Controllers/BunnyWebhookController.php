<?php

namespace App\Http\Controllers;

use App\Services\BunnyVideoStatusService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class BunnyWebhookController extends Controller
{
    public function handle(Request $request, BunnyVideoStatusService $bunnyVideos)
    {
        $payload = $request->all();

        Log::info('Bunny webhook received: ' . json_encode($payload));

        $result = $bunnyVideos->syncFromWebhookPayload($payload);

        return response()->json(['message' => $result['message']], $result['status']);
    }
}
