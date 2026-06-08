<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use App\Models\Video;

class BunnyWatchCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'bunny:watch {--interval=10 : Interval in seconds between checks}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Continuously watch and sync Bunny Stream video statuses in real-time (Local Dev Only)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $interval = (int) $this->option('interval');
        $this->info("👁️  Started watching Bunny Stream videos every {$interval} seconds...");
        $this->warn("Press Ctrl+C to stop.");

        while (true) {
            // Only sync if there are actually processing videos to save API calls
            $processingCount = Video::where('status', 'processing')
                ->whereNotNull('bunny_video_id')
                ->count();

            if ($processingCount > 0) {
                $this->line("[" . now()->format('Y-m-d H:i:s') . "] Syncing {$processingCount} processing videos...");
                
                // Call the existing bunny:sync command quietly, or you can run it normally to see the output
                Artisan::call('bunny:sync', [], $this->output);
            } else {
                // $this->line("[" . now()->format('Y-m-d H:i:s') . "] No videos processing. Waiting...");
            }

            sleep($interval);
        }
    }
}
