<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\Video;
use App\Services\BunnyBandwidthSyncService;
use App\Services\PlanService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BunnyBandwidthSyncTest extends TestCase
{
    use RefreshDatabase;

    private function logLine(string $guid, int $bytes): string
    {
        return "HIT|200|1725660000|{$bytes}|999|1.2.3.4|-|https://vz.test/{$guid}/360p/video1.ts|LAX|UA|req-1|US";
    }

    private function statsResponse(array $bytesByDate): array
    {
        $chart = [];
        foreach ($bytesByDate as $date => $bytes) {
            $chart["{$date}T00:00:00Z"] = $bytes;
        }

        return ['TotalBandwidthUsed' => array_sum($bytesByDate), 'BandwidthUsedChart' => $chart];
    }

    public function test_it_splits_bunny_daily_totals_by_cdn_logs_and_is_idempotent(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-17 12:00:00', 'UTC'));

        config([
            'video.bunny.library_id' => '123',
            'video.bunny.account_api_key' => 'account-key',
        ]);

        $tenantA = Tenant::create(['name' => 'Academy A', 'plan_tier' => 'free', 'is_active' => true]);
        $tenantB = Tenant::create(['name' => 'Academy B', 'plan_tier' => 'free', 'is_active' => true]);

        Video::create(['tenant_id' => $tenantA->id, 'title' => 'a1', 'status' => 'ready', 'privacy' => 'private', 'bunny_video_id' => 'guid-a1', 'size_bytes' => 100, 'views' => 1]);
        Video::create(['tenant_id' => $tenantB->id, 'title' => 'b1', 'status' => 'ready', 'privacy' => 'private', 'bunny_video_id' => 'guid-b1', 'size_bytes' => 100, 'views' => 3]);

        Http::fake([
            'https://api.bunny.net/videolibrary/123' => Http::response(['Id' => 123, 'PullZoneId' => 999]),
            'https://api.bunny.net/statistics*' => Http::response($this->statsResponse([
                '2026-09-30' => 9_000_000_000, // previous month: synced, but not counted this month
                '2026-10-01' => 4_000_000_000, // no log any more: fallback split by views x size (1:3)
                '2026-10-16' => 2_000_000_000,
                '2026-10-17' => 1_000_000_000,
            ])),
            // Unattributable bytes (deleted video) are spread proportionally.
            'https://logging.bunnycdn.com/10-16-26/999.log' => Http::response(implode("\n", [
                $this->logLine('guid-a1', 3_000),
                $this->logLine('guid-b1', 1_000),
                $this->logLine('deleted-guid', 500),
            ])),
            'https://logging.bunnycdn.com/10-17-26/999.log' => Http::response($this->logLine('guid-a1', 7_000)),
            'https://logging.bunnycdn.com/*' => Http::response('', 404),
        ]);

        $service = new BunnyBandwidthSyncService();
        $this->assertSame(4, $service->sync());

        $planService = new PlanService();
        // A: 1/4 of Oct 1 + 3/4 of Oct 16 + all of Oct 17 = 1 + 1.5 + 1 GB
        $this->assertSame(3.5, $planService->getBandwidthUsageGb($tenantA));
        // B: 3/4 of Oct 1 + 1/4 of Oct 16 = 3 + 0.5 GB
        $this->assertSame(3.5, $planService->getBandwidthUsageGb($tenantB->fresh()));

        $this->assertDatabaseHas('tenant_bandwidth_usages', ['tenant_id' => $tenantA->id, 'date' => '2026-10-16', 'log_bytes' => 3_000]);
        $this->assertDatabaseHas('tenant_bandwidth_usages', ['tenant_id' => $tenantA->id, 'date' => '2026-10-01', 'log_bytes' => null]);
        $this->assertNotNull($tenantA->fresh()->bandwidth_synced_at);

        // Re-running rewrites the same days instead of adding to them.
        $service->sync();
        $this->assertSame(3.5, $planService->getBandwidthUsageGb($tenantA));
        $this->assertSame(3.5, $planService->getBandwidthUsageGb($tenantB));

        // A new month starts from zero.
        Carbon::setTestNow(Carbon::parse('2026-11-01 00:30:00', 'UTC'));
        $this->assertSame(0.0, $planService->getBandwidthUsageGb($tenantA));

        Carbon::setTestNow();
    }

    public function test_a_day_keeps_its_log_based_split_after_the_log_expires(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-17 12:00:00', 'UTC'));

        config([
            'video.bunny.library_id' => '123',
            'video.bunny.account_api_key' => 'account-key',
        ]);

        $tenantA = Tenant::create(['name' => 'Academy A', 'plan_tier' => 'free', 'is_active' => true]);
        $tenantB = Tenant::create(['name' => 'Academy B', 'plan_tier' => 'free', 'is_active' => true]);

        Video::create(['tenant_id' => $tenantA->id, 'title' => 'a1', 'status' => 'ready', 'privacy' => 'private', 'bunny_video_id' => 'guid-a1', 'size_bytes' => 100, 'views' => 1]);
        Video::create(['tenant_id' => $tenantB->id, 'title' => 'b1', 'status' => 'ready', 'privacy' => 'private', 'bunny_video_id' => 'guid-b1', 'size_bytes' => 100, 'views' => 1]);

        Http::fake([
            'https://api.bunny.net/videolibrary/123' => Http::response(['PullZoneId' => 999]),
            'https://api.bunny.net/statistics*' => Http::response($this->statsResponse(['2026-10-15' => 1_000_000_000])),
            'https://logging.bunnycdn.com/10-15-26/999.log' => Http::response($this->logLine('guid-a1', 1_000)),
        ]);

        (new BunnyBandwidthSyncService())->sync(Carbon::parse('2026-10-15', 'UTC'));

        // Days later the log is gone, but the stored split is reused rather
        // than falling back to views x size (which would be 50/50 here).
        Carbon::setTestNow(Carbon::parse('2026-10-25 12:00:00', 'UTC'));

        Http::fake([
            'https://api.bunny.net/statistics*' => Http::response($this->statsResponse(['2026-10-15' => 1_000_000_000])),
            'https://logging.bunnycdn.com/*' => Http::response('', 404),
        ]);

        (new BunnyBandwidthSyncService())->sync(Carbon::parse('2026-10-15', 'UTC'));

        $planService = new PlanService();
        $this->assertSame(1.0, $planService->getBandwidthUsageGb($tenantA));
        $this->assertSame(0.0, $planService->getBandwidthUsageGb($tenantB));

        Carbon::setTestNow();
    }
}
