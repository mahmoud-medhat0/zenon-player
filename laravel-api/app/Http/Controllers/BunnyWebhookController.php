<?php

namespace App\Http\Controllers;

use App\Models\Video;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use App\Jobs\SendTenantWebhook;

class BunnyWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $payload = $request->all();
        $videoId = $payload['VideoGuid'] ?? null;
        $status = $payload['Status'] ?? null;

        Log::info('Bunny webhook received: ' . json_encode($payload));

        if (!$videoId) {
            return response()->json(['message' => 'Missing VideoGuid'], 400);
        }

        $video = Video::where('bunny_video_id', $videoId)->first();

        if (!$video) {
            Log::warning('Bunny webhook received for unknown video: ' . $videoId);
            return response()->json(['message' => 'Video not found'], 404);
        }

        // Bunny Stream Statuses: 4 = Finished processing
        if ($status == 4) {
            // Fetch video duration from Bunny API
            $libraryId = config('video.bunny.library_id');
            $apiKey = config('video.bunny.api_key');
            
            try {
                $response = Http::withHeaders([
                    'AccessKey' => $apiKey,
                    'accept' => 'application/json'
                ])->get("https://video.bunnycdn.com/library/{$libraryId}/videos/{$videoId}");
                
                if ($response->successful()) {
                    $length = $response->json('length');
                    if ($length) {
                        $video->duration_seconds = round($length);
                    }
                }
            } catch (\Exception $e) {
                Log::error('Failed to fetch duration from Bunny: ' . $e->getMessage());
            }

            $video->status = 'ready';
            $video->save();

            Log::info('Video marked as ready from Bunny: ' . $video->id);
            SendTenantWebhook::dispatch($video, 'video.ready');

        } elseif ($status == 5 || $status == 6) { // 5 = Failed, 6 = Upload failed
            $video->update([
                'status' => 'failed',
            ]);
            SendTenantWebhook::dispatch($video, 'video.failed');
        }

        return response()->json(['message' => 'Webhook processed']);
    }
}
