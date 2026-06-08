<?php

namespace App\Http\Controllers;

use App\Models\Video;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class CloudflareWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $signatureHeader = $request->header('Webhook-Signature');
        $secret = env('CLOUDFLARE_WEBHOOK_SECRET');

        if (!$secret || !$signatureHeader) {
            return response()->json(['message' => 'Missing signature or secret'], 400);
        }

        // The header looks like: time=1614713915,sig1=859c231711200f6b...
        $parts = explode(',', $signatureHeader);
        $timePart = null;
        $sig1Part = null;

        foreach ($parts as $part) {
            if (str_starts_with($part, 'time=')) {
                $timePart = substr($part, 5);
            } elseif (str_starts_with($part, 'sig1=')) {
                $sig1Part = substr($part, 5);
            }
        }

        if (!$timePart || !$sig1Part) {
            return response()->json(['message' => 'Invalid signature format'], 400);
        }

        $body = $request->getContent();
        $sourceString = $timePart . '.' . $body;
        $expectedSignature = hash_hmac('sha256', $sourceString, $secret);

        if (!hash_equals($expectedSignature, $sig1Part)) {
            Log::warning('Cloudflare webhook signature mismatch', ['expected' => $expectedSignature, 'received' => $sig1Part]);
            return response()->json(['message' => 'Invalid signature'], 401);
        }

        // Verification passed, handle payload
        $payload = json_decode($body, true);

        if (!isset($payload['uid'])) {
            return response()->json(['message' => 'No UID in payload'], 400);
        }

        $video = Video::where('cloudflare_uid', $payload['uid'])->first();

        if (!$video) {
            Log::info('Cloudflare webhook received for unknown video: ' . $payload['uid']);
            return response()->json(['message' => 'Video not found'], 404);
        }

        if (isset($payload['readyToStream']) && $payload['readyToStream'] === true) {
            $updateData = ['status' => 'ready'];

            if (isset($payload['meta']['durationSeconds'])) {
                $updateData['duration_seconds'] = round($payload['meta']['durationSeconds']);
            } elseif (isset($payload['duration'])) {
                $updateData['duration_seconds'] = round($payload['duration']);
            }

            $video->update($updateData);
            Log::info('Video marked as ready from Cloudflare: ' . $video->id);
        }

        return response()->json(['message' => 'Webhook processed']);
    }
}
