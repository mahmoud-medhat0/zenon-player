<?php

namespace App\Console\Commands;

use App\Models\Video;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class BunnySyncCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'bunny:sync';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync video statuses from Bunny Stream API (useful for local development)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $libraryId = config('video.bunny.library_id');
        $apiKey = config('video.bunny.api_key');

        if (!$libraryId || !$apiKey) {
            $this->error('Bunny Stream credentials missing in .env');
            return;
        }

        $videos = Video::where('status', 'processing')
            ->whereNotNull('bunny_video_id')
            ->get();

        if ($videos->isEmpty()) {
            $this->info('No processing Bunny videos found to sync.');
            return;
        }

        $this->info("Found {$videos->count()} videos processing on Bunny Stream. Checking statuses...");

        foreach ($videos as $video) {
            try {
                $response = Http::withHeaders([
                    'AccessKey' => $apiKey,
                    'Accept' => 'application/json',
                ])->get("https://video.bunnycdn.com/library/{$libraryId}/videos/{$video->bunny_video_id}");

                if ($response->successful()) {
                    $status = $response->json('status');
                    
                    if ($status == 3 || $status == 4) { // Finished
                        $length = $response->json('length');
                        $video->update([
                            'status' => 'ready',
                            'duration_seconds' => $length ? round($length) : null,
                        ]);
                        \App\Jobs\SendTenantWebhook::dispatch($video, 'video.ready');
                        $this->info("✅ Video {$video->id} is now Ready!");
                    } elseif ($status == 5 || $status == 6) { // Failed
                        $video->update(['status' => 'failed']);
                        \App\Jobs\SendTenantWebhook::dispatch($video, 'video.failed');
                        $this->error("❌ Video {$video->id} Failed on Bunny.");
                    } else {
                        $this->line("⏳ Video {$video->id} is still encoding (Status: {$status})...");
                    }
                } else {
                    $this->error("Failed to fetch status for video {$video->id}");
                }
            } catch (\Exception $e) {
                $this->error("Error syncing video {$video->id}: " . $e->getMessage());
            }
        }

        $this->info('Sync completed.');
    }
}
