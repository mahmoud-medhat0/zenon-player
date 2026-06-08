<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\Video;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class VimeoToBunnyCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'vimeo:migrate {--page=1 : The page of Vimeo videos to fetch} {--per_page=20 : Number of videos per page} {--tenant=1 : The tenant ID to assign videos to}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Migrate videos from Vimeo to Bunny Stream automatically';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $vimeoToken = config('video.vimeo.access_token');
        $bunnyLibraryId = config('video.bunny.library_id');
        $bunnyApiKey = config('video.bunny.api_key');

        if (!$vimeoToken) {
            $this->error('VIMEO_ACCESS_TOKEN is not set in .env');
            return;
        }

        if (!$bunnyLibraryId || !$bunnyApiKey) {
            $this->error('Bunny Stream credentials are not set in .env');
            return;
        }

        $page = $this->option('page');
        $perPage = $this->option('per_page');
        $tenantId = $this->option('tenant');

        $tenant = Tenant::find($tenantId);
        if (!$tenant) {
            $this->error("Tenant ID {$tenantId} not found.");
            return;
        }

        $this->info("Fetching videos from Vimeo (Page: {$page}, Per Page: {$perPage})...");

        // Fetch videos from Vimeo
        $response = Http::withToken($vimeoToken)
            ->get("https://api.vimeo.com/me/videos", [
                'page' => $page,
                'per_page' => $perPage,
                'fields' => 'uri,name,duration,files,pictures',
            ]);

        if (!$response->successful()) {
            $this->error("Failed to fetch from Vimeo API. Status: " . $response->status());
            $this->error($response->body());
            return;
        }

        $videos = $response->json('data');

        if (empty($videos)) {
            $this->info("No more videos found on Vimeo.");
            return;
        }

        $this->info("Found " . count($videos) . " videos. Starting migration...");

        foreach ($videos as $vimeoVideo) {
            $title = $vimeoVideo['name'] ?? 'Untitled Video';
            $duration = $vimeoVideo['duration'] ?? 0;
            $files = $vimeoVideo['files'] ?? [];

            $this->line("Processing: {$title}...");

            // Extract the highest quality MP4 file
            $mp4Url = null;
            $highestWidth = 0;

            foreach ($files as $file) {
                if (($file['type'] === 'video/mp4' || $file['quality'] !== 'hls') && isset($file['link']) && $file['link']) {
                    $width = $file['width'] ?? 0;
                    if ($width > $highestWidth) {
                        $highestWidth = $width;
                        $mp4Url = $file['link'];
                    }
                }
            }

            if (!$mp4Url) {
                $this->warn("Skipped: {$title} (No direct MP4 file link found. Ensure your Vimeo token has 'video_files' scope and you have a Pro+ account).");
                continue;
            }

            // Create Video record in our database
            $videoRecord = Video::create([
                'tenant_id' => $tenant->id,
                'title' => $title,
                'status' => 'processing',
                'privacy' => 'private',
                'duration_seconds' => $duration,
                'size_bytes' => 0, // We don't know the size yet
            ]);

            // Call Bunny Stream Fetch API
            $fetchResponse = Http::withHeaders([
                'AccessKey' => $bunnyApiKey,
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ])->post("https://video.bunnycdn.com/library/{$bunnyLibraryId}/videos/fetch", [
                'url' => $mp4Url,
                'title' => $title,
            ]);

            if (!$fetchResponse->successful()) {
                $this->error("Failed to fetch video to Bunny Stream for: {$title}");
                $this->error($fetchResponse->body());
                $videoRecord->update(['status' => 'failed']);
                continue;
            }

            $bunnyVideoId = $fetchResponse->json('id');

            $videoRecord->update([
                'bunny_video_id' => $bunnyVideoId,
            ]);

            $this->info("✅ Successfully queued for migration: {$title} (Bunny ID: {$bunnyVideoId})");
        }

        $this->info("Migration for page {$page} completed! You can check Bunny Stream Dashboard to see the downloads in progress.");
        $this->info("To fetch the next page, run: php artisan vimeo:migrate --page=" . ($page + 1));
    }
}
