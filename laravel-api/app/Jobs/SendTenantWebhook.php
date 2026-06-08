<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Video;

class SendTenantWebhook implements ShouldQueue
{
    use Queueable;

    public $video;
    public $event;

    /**
     * Create a new job instance.
     */
    public function __construct(Video $video, string $event = 'video.status_changed')
    {
        $this->video = $video;
        $this->event = $event;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $tenant = $this->video->tenant;

        if (!$tenant || !$tenant->webhook_url) {
            return;
        }

        $payload = [
            'event' => $this->event,
            'video_id' => $this->video->id,
            'status' => $this->video->status,
            'bunny_video_id' => $this->video->bunny_video_id,
            'cloudflare_uid' => $this->video->cloudflare_uid,
            'duration' => $this->video->duration_seconds,
            'timestamp' => now()->toIso8601String(),
        ];

        Log::info("Preparing to send Tenant Webhook for Video: {$this->video->id} to URL: {$tenant->webhook_url}");

        try {
            $request = Http::timeout(10)->withOptions(['verify' => false]);
            
            if ($tenant->webhook_secret) {
                $request->withHeaders([
                    'X-Zenon-Signature' => hash_hmac('sha256', json_encode($payload), $tenant->webhook_secret)
                ]);
            }

            Log::info("Sending Tenant Webhook payload:", $payload);
            $response = $request->post($tenant->webhook_url, $payload);

            if (!$response->successful()) {
                Log::warning("Tenant Webhook Failed for Tenant {$tenant->id}. Status: " . $response->status() . " Body: " . $response->body());
            } else {
                Log::info("Tenant Webhook Success for Tenant {$tenant->id}. Body: " . $response->body());
            }
        } catch (\Exception $e) {
            Log::error("Tenant Webhook Exception for Tenant {$tenant->id}: " . $e->getMessage());
        }
    }
}
