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

    public $timeout = 600;

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
            Log::error("Failed to fetch video to Bunny Stream for: {$this->video->title}");
            $this->video->update(['status' => 'failed']);
            return;
        }

        $bunnyVideoId = $fetchResponse->json('id');

        $this->video->update([
            'bunny_video_id' => $bunnyVideoId,
        ]);
    }
}
