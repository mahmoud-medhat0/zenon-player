<?php

namespace App\Http\Controllers;

use App\Models\Video;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

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
            $video->update([
                'status' => 'ready',
            ]);
            Log::info('Video marked as ready from Bunny: ' . $video->id);
        } elseif ($status == 5 || $status == 6) { // 5 = Failed, 6 = Upload failed
            $video->update([
                'status' => 'failed',
            ]);
        }

        return response()->json(['message' => 'Webhook processed']);
    }
}
