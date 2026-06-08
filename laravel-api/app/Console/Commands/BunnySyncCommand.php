<?php

namespace App\Console\Commands;

use App\Jobs\SendTenantWebhook;
use App\Models\Video;
use App\Services\BunnyVideoStatusService;
use Illuminate\Console\Command;

class BunnySyncCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'bunny:sync {--notify-ready : Resend ready tenant webhooks for videos that are already ready}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync video statuses from Bunny Stream API (useful for local development)';

    /**
     * Execute the console command.
     */
    public function handle(BunnyVideoStatusService $bunnyVideos)
    {
        $libraryId = config('video.bunny.library_id');
        $apiKey = config('video.bunny.api_key');

        if (!$libraryId || !$apiKey) {
            $this->error('Bunny Stream credentials missing in .env');
            return;
        }

        $statuses = $this->option('notify-ready') ? ['processing', 'ready'] : ['processing'];

        $videos = Video::whereIn('status', $statuses)
            ->whereNotNull('bunny_video_id')
            ->get();

        if ($videos->isEmpty()) {
            $this->info('No Bunny videos found to sync.');
            return;
        }

        $this->info("Found {$videos->count()} Bunny Stream videos to sync.");

        foreach ($videos as $video) {
            if ($video->status === 'ready') {
                SendTenantWebhook::dispatchSync($video, 'video.ready');
                $this->info("Ready webhook resent for video {$video->id}.");
                continue;
            }

            $previousStatus = $video->status;
            $changed = $bunnyVideos->syncFromBunny($video);
            $video->refresh();

            if ($changed && $video->status === 'ready') {
                $this->info("Video {$video->id} is now ready.");
            } elseif ($changed && $video->status === 'failed') {
                $this->error("Video {$video->id} failed on Bunny.");
            } elseif ($previousStatus === $video->status) {
                $this->line("Video {$video->id} is still {$video->status}.");
            }
        }

        $this->info('Sync completed.');
    }
}
