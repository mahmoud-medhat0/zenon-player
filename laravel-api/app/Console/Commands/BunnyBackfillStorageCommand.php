<?php

namespace App\Console\Commands;

use App\Models\Video;
use App\Services\BunnyVideoStatusService;
use Illuminate\Console\Command;

class BunnyBackfillStorageCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'bunny:backfill-storage {--limit= : Only process this many videos, for a test run}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Refresh size_bytes for existing Bunny videos from Bunny\'s real storageSize (fixes storage totals stuck at 0/stale for videos uploaded before this was tracked)';

    /**
     * Execute the console command.
     */
    public function handle(BunnyVideoStatusService $bunnyVideos): int
    {
        $query = Video::whereNotNull('bunny_video_id');

        if ($limit = $this->option('limit')) {
            $query->limit((int) $limit);
        }

        $videos = $query->get();

        if ($videos->isEmpty()) {
            $this->info('No Bunny-hosted videos found.');
            return self::SUCCESS;
        }

        $this->info("Refreshing storage size for {$videos->count()} video(s)...");

        $updated = 0;
        $stillZero = [];

        $bar = $this->output->createProgressBar($videos->count());
        $bar->start();

        foreach ($videos as $video) {
            $before = $video->size_bytes;

            $bunnyVideos->syncFromBunny($video);
            $video->refresh();

            if ($video->size_bytes != $before) {
                $updated++;
            }

            if ((int) $video->size_bytes <= 0) {
                $stillZero[] = "{$video->title} (status: {$video->status}, guid: {$video->bunny_video_id})";
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine();

        $this->info("Updated size_bytes for {$updated} video(s).");

        if (!empty($stillZero)) {
            $this->warn(count($stillZero) . ' video(s) still have no storage size (still processing, failed, or Bunny fetch failed):');
            foreach (array_slice($stillZero, 0, 20) as $line) {
                $this->line("  - {$line}");
            }
            if (count($stillZero) > 20) {
                $this->line('  ... and ' . (count($stillZero) - 20) . ' more.');
            }
        }

        return self::SUCCESS;
    }
}
