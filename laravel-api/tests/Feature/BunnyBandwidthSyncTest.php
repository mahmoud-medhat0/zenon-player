<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\Video;
use App\Services\BunnyBandwidthSyncService;
use App\Services\PlanService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BunnyBandwidthSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_attributes_log_bytes_to_the_right_tenant_and_is_idempotent(): void
    {
        config([
            'video.bunny.library_id' => '123',
            'video.bunny.api_key' => 'bunny-key',
            'video.bunny.account_api_key' => 'account-key',
        ]);

        $tenantA = Tenant::create(['name' => 'Academy A', 'plan_tier' => 'free', 'is_active' => true]);
        $tenantB = Tenant::create(['name' => 'Academy B', 'plan_tier' => 'free', 'is_active' => true]);

        Video::create(['tenant_id' => $tenantA->id, 'title' => 'a1', 'status' => 'ready', 'privacy' => 'private', 'bunny_video_id' => 'guid-a1']);
        Video::create(['tenant_id' => $tenantB->id, 'title' => 'b1', 'status' => 'ready', 'privacy' => 'private', 'bunny_video_id' => 'guid-b1']);

        $yesterday = now()->subDay();
        $dayBefore = now()->subDays(2);

        $logLine = fn (string $guid, int $bytes) =>
            "HIT|200|1725660000|{$bytes}|999|1.2.3.4|-|https://vz.test/{$guid}/seg.ts|LAX|UA|req-1|US";

        Http::fake([
            'https://video.bunnycdn.com/library/123' => Http::response(['Id' => 123, 'PullZoneId' => 999]),
            'https://logging.bunnycdn.com/' . $yesterday->format('m-d-y') . '/999.log' => Http::response(
                $logLine('guid-a1', 10_000_000) . "\n" . $logLine('guid-b1', 3_000_000)
            ),
            'https://logging.bunnycdn.com/' . $dayBefore->format('m-d-y') . '/999.log' => Http::response(
                $logLine('guid-a1', 5_000_000)
            ),
        ]);

        $service = new BunnyBandwidthSyncService();
        $synced = $service->syncPendingDays();

        $this->assertSame(2, $synced);

        $tenantA->refresh();
        $tenantB->refresh();

        $this->assertSame(15_000_000, $tenantA->bandwidth_used_bytes);
        $this->assertSame(3_000_000, $tenantB->bandwidth_used_bytes);
        $this->assertNotNull($tenantA->bandwidth_synced_at);

        $this->assertDatabaseCount('bunny_log_syncs', 2);

        // Running again must not double-count or re-fetch already-synced days.
        Http::fake([
            'https://logging.bunnycdn.com/*' => Http::response('should not be called', 500),
        ]);

        $secondRun = $service->syncPendingDays();
        $this->assertSame(0, $secondRun);

        $tenantA->refresh();
        $this->assertSame(15_000_000, $tenantA->bandwidth_used_bytes);

        $planService = new PlanService();
        $this->assertSame(round(15_000_000 / (1024 ** 3), 2), $planService->getBandwidthUsageGb($tenantA));
    }
}
