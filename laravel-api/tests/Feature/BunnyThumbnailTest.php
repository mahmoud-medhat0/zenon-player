<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\Video;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BunnyThumbnailTest extends TestCase
{
    use RefreshDatabase;

    public function test_bunny_thumbnail_is_fetched_with_our_referer_and_passed_through(): void
    {
        $video = $this->bunnyVideo();

        Http::fake([
            'https://vz.test/bunny-guid/thumbnail.jpg*' => Http::response('jpeg-bytes', 200, ['Content-Type' => 'image/jpeg']),
        ]);

        $response = $this->get("/api/videos/{$video->id}/thumbnail");

        $response->assertOk();
        $this->assertSame('jpeg-bytes', $response->getContent());
        $this->assertSame('image/jpeg', $response->headers->get('Content-Type'));

        // The pull zone refuses requests without an allowed referrer; a redirect cannot carry one.
        Http::assertSent(fn (HttpRequest $request) => str_starts_with($request->url(), 'https://vz.test/bunny-guid/thumbnail.jpg')
            && $request->header('Referer') === [rtrim(config('app.url'), '/').'/']);
    }

    public function test_a_thumbnail_bunny_refuses_is_a_404_not_an_error(): void
    {
        $video = $this->bunnyVideo();

        Http::fake(['https://vz.test/*' => Http::response('Forbidden', 403)]);

        $this->get("/api/videos/{$video->id}/thumbnail")->assertNotFound();
    }

    private function bunnyVideo(): Video
    {
        config(['video.bunny.pull_zone' => 'vz.test', 'video.bunny.security_key' => 'secret']);

        $tenant = Tenant::create(['name' => 'Academy', 'plan_tier' => 'free', 'is_active' => true]);

        return Video::create([
            'tenant_id' => $tenant->id,
            'title' => 'lesson',
            'status' => 'ready',
            'privacy' => 'public',
            'bunny_video_id' => 'bunny-guid',
        ]);
    }
}
