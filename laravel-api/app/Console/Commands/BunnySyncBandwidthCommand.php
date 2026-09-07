<?php

namespace App\Console\Commands;

use App\Services\BunnyBandwidthSyncService;
use Illuminate\Console\Command;

class BunnySyncBandwidthCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'bunny:sync-bandwidth';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Fold newly available Bunny CDN log days into per-tenant bandwidth totals';

    /**
     * Execute the console command.
     */
    public function handle(BunnyBandwidthSyncService $bunnyBandwidth): int
    {
        if (!config('video.bunny.account_api_key')) {
            $this->info('BUNNY_ACCOUNT_API_KEY is not set; skipping.');
            return self::SUCCESS;
        }

        $synced = $bunnyBandwidth->syncPendingDays();

        $this->info("Processed {$synced} day(s) of Bunny logs.");

        return self::SUCCESS;
    }
}
