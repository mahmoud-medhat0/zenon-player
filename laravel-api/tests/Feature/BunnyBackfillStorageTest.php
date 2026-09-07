<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\Video;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BunnyBackfillStorageTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_backfills_size_bytes_for_already_ready_videos(): void
    {
        config([
            'video.bunny.library_id' => '123',
            'video.bunny.api_key' => 'bunny-key',
        ]);

        $tenant = Tenant::create(['name' => 'Academy', 'plan_tier' => 'free', 'is_active' => true]);

        $video = Video::create([
            'tenant_id' => $tenant->id,
            'title' => 'old upload',
            'status' => 'ready',
            'privacy' => 'private',
            'bunny_video_id' => 'bunny-guid',
            'size_bytes' => 0,
        ]);

        Http::fake([
            'https://video.bunnycdn.com/library/123/videos/bunny-guid' => Http::response([
                'guid' => 'bunny-guid',
                'status' => 3,
                'length' => 248,
                'storageSize' => 734000000,
            ]),
        ]);

        $this->artisan('bunny:backfill-storage')->assertSuccessful();

        $this->assertSame(734000000, $video->fresh()->size_bytes);
    }
}
