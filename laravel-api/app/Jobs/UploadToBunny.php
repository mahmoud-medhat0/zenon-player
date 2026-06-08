<?php

namespace App\Jobs;

use App\Models\Video;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class UploadToBunny implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 7200; // 2 hours

    public function __construct(public Video $video)
    {
    }

    public function handle(): void
    {
        $libraryId = config('video.bunny.library_id');
        $apiKey = config('video.bunny.api_key');

        if (!$libraryId || !$apiKey) {
            Log::error("Bunny Stream credentials missing");
            $this->video->update(['status' => 'failed']);
            return;
        }

        $filePath = "videos/{$this->video->tenant_id}/{$this->video->id}.mp4";
        $fullPath = storage_path("app/private/" . $filePath);

        if (!file_exists($fullPath)) {
            Log::error("Video file not found for Bunny upload: " . $fullPath);
            $this->video->update(['status' => 'failed']);
            return;
        }

        // 1. Create Video Object in Bunny
        $createResponse = Http::withHeaders([
            'AccessKey' => $apiKey,
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
        ])->post("https://video.bunnycdn.com/library/{$libraryId}/videos", [
            'title' => $this->video->title,
        ]);

        if (!$createResponse->successful()) {
            Log::error("Failed to create video in Bunny: " . $createResponse->body());
            $this->video->update(['status' => 'failed']);
            return;
        }

        $guid = $createResponse->json('guid');

        $this->video->update([
            'bunny_video_id' => $guid,
        ]);

        // 2. Upload the file
        Log::info("Starting upload to Bunny for video {$this->video->id} (Bunny ID: {$guid})");

        $fileStream = fopen($fullPath, 'r');
        $uploadResponse = Http::withHeaders([
            'AccessKey' => $apiKey,
            'Accept' => 'application/json',
            'Content-Type' => 'application/octet-stream',
        ])->send('PUT', "https://video.bunnycdn.com/library/{$libraryId}/videos/{$guid}", [
            'body' => $fileStream,
        ]);

        if (is_resource($fileStream)) {
            fclose($fileStream);
        }

        if (!$uploadResponse->successful()) {
            Log::error("Failed to upload video content to Bunny: " . $uploadResponse->body());
            $this->video->update(['status' => 'failed']);
            return;
        }

        Log::info("Successfully uploaded video {$this->video->id} to Bunny. Awaiting webhook for completion.");

        // Dispatch webhook for processing state
        \App\Jobs\SendTenantWebhook::dispatchSync($this->video->fresh(), 'video.processing');

        // Delete the local file to save space
        Storage::disk('local')->delete($filePath);
    }
}
