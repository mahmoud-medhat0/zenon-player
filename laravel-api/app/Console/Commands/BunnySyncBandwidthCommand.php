<?php

namespace App\Console\Commands;

use App\Services\BunnyBandwidthSyncService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class BunnySyncBandwidthCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'bunny:sync-bandwidth {--from= : Re-sync from this date (Y-m-d) instead of the start of the current month}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync per-tenant daily bandwidth from Bunny statistics, split per tenant by the raw CDN logs';

    /**
     * Execute the console command.
     */
    public function handle(BunnyBandwidthSyncService $bunnyBandwidth): int
    {
        if (!config('video.bunny.account_api_key')) {
            $this->info('BUNNY_ACCOUNT_API_KEY is not set; skipping.');
            return self::SUCCESS;
        }

        $from = $this->option('from') ? Carbon::parse($this->option('from'), 'UTC') : null;

        $synced = $bunnyBandwidth->sync($from);

        $this->info("Synced bandwidth for {$synced} day(s).");

        return self::SUCCESS;
    }
}
