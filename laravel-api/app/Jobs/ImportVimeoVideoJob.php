<?php

namespace App\Jobs;

use App\Models\Video;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ImportVimeoVideoJob implements ShouldQueue
{
    use Queueable;

    public $tries = 5;
    public $timeout = 600;
    
    // Use exponential backoff for retries: 1m, 2m, 4m, 8m...
    public $backoff = [60, 120, 240, 480];

    public function __construct(public Video $video, public string $mp4Url)
    {
    }

    public function handle(): void
    {
        $bunnyLibraryId = config('video.bunny.library_id');
        $bunnyApiKey = config('video.bunny.api_key');

        if (!$bunnyLibraryId || !$bunnyApiKey) {
            Log::error('Bunny Stream credentials are not set in .env');
            $this->video->update(['status' => 'failed']);
            return;
        }

        $fetchResponse = Http::withHeaders([
            'AccessKey' => $bunnyApiKey,
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
        ])->post("https://video.bunnycdn.com/library/{$bunnyLibraryId}/videos/fetch", [
            'url' => $this->mp4Url,
            'title' => $this->video->title,
        ]);

        if (!$fetchResponse->successful()) {
            if ($fetchResponse->status() === 429 || $fetchResponse->serverError()) {
                Log::warning("Bunny API limit/error. Retrying {$this->video->title}. Status: {$fetchResponse->status()}");
                throw new \Exception("Bunny API Error: " . $fetchResponse->status());
            }

            Log::error("Failed to fetch video to Bunny Stream for: {$this->video->title}. Status: {$fetchResponse->status()} Body: {$fetchResponse->body()}");
            $this->video->update(['status' => 'failed']);
            return;
        }

        $bunnyVideoId = $fetchResponse->json('id');

        $this->video->update([
            'bunny_video_id' => $bunnyVideoId,
        ]);
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error("ImportVimeoVideoJob failed completely for video {$this->video->id}: " . $exception->getMessage());
        $this->video->update(['status' => 'failed']);
    }
}
