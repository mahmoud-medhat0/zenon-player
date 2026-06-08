<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use App\Models\Video;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BunnyWebhookTest extends TestCase
{
    use RefreshDatabase;

    public function test_bunny_webhook_marks_video_ready_and_notifies_tenant(): void
    {
        $this->configureBunny();

        $tenant = $this->createTenantWithWebhook();
        $video = $this->createProcessingBunnyVideo($tenant);

        Http::fake([
            'https://video.bunnycdn.com/library/123/videos/bunny-guid' => Http::response([
                'guid' => 'bunny-guid',
                'status' => 3,
                'length' => 248,
            ]),
            'https://academy.test/api/zenon-webhook' => Http::response(['message' => 'ok']),
        ]);

        $this->postJson('/api/webhooks/bunny', [
            'VideoGuid' => 'bunny-guid',
            'Status' => 3,
        ])->assertOk();

        $this->assertDatabaseHas('videos', [
            'id' => $video->id,
            'status' => 'ready',
            'duration_seconds' => 248,
        ]);

        Http::assertSent(fn (HttpRequest $request) => $this->isReadyTenantWebhook($request, $video));
    }

    public function test_dashboard_lazy_bunny_sync_sends_ready_webhook(): void
    {
        $this->configureBunny();

        $tenant = $this->createTenantWithWebhook();
        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Owner User',
            'email' => 'owner@example.com',
            'password' => Hash::make('password'),
            'role' => 'owner',
            'is_active' => true,
        ]);
        $video = $this->createProcessingBunnyVideo($tenant);

        Http::fake([
            'https://video.bunnycdn.com/library/123/videos/bunny-guid' => Http::response([
                'guid' => 'bunny-guid',
                'status' => 4,
                'length' => 248,
            ]),
            'https://academy.test/api/zenon-webhook' => Http::response(['message' => 'ok']),
        ]);

        $this->actingAs($user)
            ->getJson('/api/videos')
            ->assertOk()
            ->assertJsonFragment([
                'status' => 'ready',
                'duration' => '04:08',
            ]);

        $this->assertDatabaseHas('videos', [
            'id' => $video->id,
            'status' => 'ready',
            'duration_seconds' => 248,
        ]);

        Http::assertSent(fn (HttpRequest $request) => $this->isReadyTenantWebhook($request, $video));
    }

    public function test_public_video_details_lazy_syncs_bunny_before_returning_status(): void
    {
        $this->configureBunny();

        $tenant = $this->createTenantWithWebhook();
        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'API User',
            'email' => 'api-user@example.com',
            'password' => Hash::make('password'),
            'role' => 'owner',
            'is_active' => true,
        ]);
        $video = $this->createProcessingBunnyVideo($tenant);

        Http::fake([
            'https://video.bunnycdn.com/library/123/videos/bunny-guid' => Http::response([
                'guid' => 'bunny-guid',
                'status' => 3,
                'length' => 248,
            ]),
            'https://academy.test/api/zenon-webhook' => Http::response(['message' => 'ok']),
        ]);

        $this->actingAs($user)
            ->getJson("/api/public/videos/{$video->id}")
            ->assertOk()
            ->assertJson([
                'id' => $video->id,
                'status' => 'ready',
                'duration' => 248,
                'thumbnail_url' => 'https://vz.test/bunny-guid/thumbnail.jpg',
            ]);

        $this->assertDatabaseHas('videos', [
            'id' => $video->id,
            'status' => 'ready',
            'duration_seconds' => 248,
        ]);

        Http::assertSent(fn (HttpRequest $request) => $this->isReadyTenantWebhook($request, $video));
    }

    private function configureBunny(): void
    {
        config([
            'video.bunny.library_id' => '123',
            'video.bunny.api_key' => 'bunny-key',
            'video.bunny.pull_zone' => 'vz.test',
        ]);
    }

    private function createTenantWithWebhook(): Tenant
    {
        return Tenant::create([
            'name' => 'Academy',
            'plan_tier' => 'free',
            'is_active' => true,
            'webhook_url' => 'https://academy.test/api/zenon-webhook',
            'webhook_secret' => 'secret',
        ]);
    }

    private function createProcessingBunnyVideo(Tenant $tenant): Video
    {
        return Video::create([
            'tenant_id' => $tenant->id,
            'title' => 'test1',
            'status' => 'processing',
            'privacy' => 'private',
            'bunny_video_id' => 'bunny-guid',
        ]);
    }

    private function isReadyTenantWebhook(HttpRequest $request, Video $video): bool
    {
        if ($request->url() !== 'https://academy.test/api/zenon-webhook') {
            return false;
        }

        $payload = $request->data();
        $signature = $request->header('X-Zenon-Signature')[0] ?? null;

        return $payload['event'] === 'video.ready'
            && $payload['video_id'] === $video->id
            && $payload['status'] === 'ready'
            && $payload['duration'] === 248
            && $payload['duration_seconds'] === 248
            && $payload['thumbnail_url'] === 'https://vz.test/bunny-guid/thumbnail.jpg'
            && $signature === hash_hmac('sha256', json_encode($payload), 'secret');
    }
}
