<?php

namespace App\Jobs;

use App\Models\Video;
use App\Services\BunnyVideoStatusService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;

class SyncBunnyVideoStatuses implements ShouldQueue
{
    use Queueable;

    /**
     * Get the middleware the job should pass through.
     *
     * @return array<int, object>
     */
    public function middleware(): array
    {
        $middleware = new WithoutOverlapping('sync_bunny_videos');
        return [$middleware->releaseAfter(30)];
    }

    /**
     * Execute the job.
     */
    public function handle(BunnyVideoStatusService $bunnyVideos): void
    {
        $processingVideos = Video::where('status', 'processing')->whereNotNull('bunny_video_id')->get();
        foreach ($processingVideos as $video) {
            $bunnyVideos->syncFromBunny($video);
        }
    }
}
