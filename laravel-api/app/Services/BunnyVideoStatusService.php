<?php

namespace App\Services;

use App\Jobs\SendTenantWebhook;
use App\Models\Video;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BunnyVideoStatusService
{
    private const PROCESSING_STATUSES = [0, 1, 2, 6, 7];
    private const READY_STATUSES = [3, 4];
    private const FAILED_STATUSES = [5, 8];

    public function syncFromWebhookPayload(array $payload): array
    {
        $videoGuid = $this->getPayloadValue($payload, ['VideoGuid', 'videoGuid', 'video_guid', 'guid']);
        $status = $this->normalizeStatus($this->getPayloadValue($payload, ['Status', 'status']));

        if (!$videoGuid) {
            return ['ok' => false, 'status' => 400, 'message' => 'Missing VideoGuid'];
        }

        if ($status === null) {
            return ['ok' => false, 'status' => 400, 'message' => 'Missing Status'];
        }

        $video = Video::where('bunny_video_id', $videoGuid)->first();

        if (!$video) {
            Log::warning('Bunny webhook received for unknown video: ' . $videoGuid);
            return ['ok' => false, 'status' => 404, 'message' => 'Video not found'];
        }

        $details = $payload;

        if ($this->isReadyStatus($status) && !$this->extractLength($details)) {
            $details = array_merge($details, $this->fetchDetails($videoGuid) ?? []);
        }

        $changed = $this->applyStatus($video, $status, $details);

        return [
            'ok' => true,
            'status' => 200,
            'message' => $changed ? 'Webhook processed' : 'Webhook processed without changes',
            'video' => $video->fresh(),
            'changed' => $changed,
        ];
    }

    public function syncFromBunny(Video $video): bool
    {
        if (!$video->bunny_video_id) {
            return false;
        }

        $details = $this->fetchDetails($video->bunny_video_id);

        if (!$details) {
            return false;
        }

        $status = $this->normalizeStatus($details['status'] ?? null);

        if ($status === null) {
            Log::warning("Bunny returned video {$video->bunny_video_id} without a status.");
            return false;
        }

        return $this->applyStatus($video, $status, $details);
    }

    public function applyStatus(Video $video, int $status, array $details = []): bool
    {
        $updates = [];
        $event = null;

        if ($this->isReadyStatus($status)) {
            $updates['status'] = 'ready';
            $length = $this->extractLength($details);

            if ($length !== null) {
                $updates['duration_seconds'] = (int) round($length);
            }

            $event = 'video.ready';
        } elseif (in_array($status, self::FAILED_STATUSES, true)) {
            $updates['status'] = 'failed';
            $event = 'video.failed';
        } elseif (in_array($status, self::PROCESSING_STATUSES, true)) {
            if (in_array($video->status, ['ready', 'failed'], true)) {
                Log::info("Ignoring Bunny processing status {$status} for already {$video->status} video {$video->id}.");
                return false;
            }

            $updates['status'] = 'processing';
            $event = 'video.processing';
        } else {
            Log::info("Ignoring Bunny informational status {$status} for video {$video->id}.");
            return false;
        }

        $video->fill($updates);

        if (!$video->isDirty()) {
            return false;
        }

        $statusChanged = $video->isDirty('status');
        $durationChanged = $video->isDirty('duration_seconds');
        $video->save();

        if ($event && ($statusChanged || ($event === 'video.ready' && $durationChanged))) {
            SendTenantWebhook::dispatchSync($video->fresh(), $event);
        }

        Log::info("Video {$video->id} synced from Bunny status {$status} to {$video->status}.");

        return true;
    }

    public function fetchDetails(string $videoGuid): ?array
    {
        $libraryId = config('video.bunny.library_id');
        $apiKey = config('video.bunny.api_key');

        if (!$libraryId || !$apiKey) {
            Log::warning('Cannot fetch Bunny video details because credentials are missing.');
            return null;
        }

        try {
            $response = Http::withHeaders([
                'AccessKey' => $apiKey,
                'Accept' => 'application/json',
            ])->get("https://video.bunnycdn.com/library/{$libraryId}/videos/{$videoGuid}");

            if (!$response->successful()) {
                Log::warning("Failed to fetch Bunny details for {$videoGuid}. Status: " . $response->status() . ' Body: ' . $response->body());
                return null;
            }

            return $response->json();
        } catch (\Throwable $e) {
            Log::error('Failed to fetch duration from Bunny: ' . $e->getMessage());
            return null;
        }
    }

    private function normalizeStatus(mixed $status): ?int
    {
        if ($status === null || $status === '') {
            return null;
        }

        if (is_numeric($status)) {
            return (int) $status;
        }

        return null;
    }

    private function getPayloadValue(array $payload, array $keys): mixed
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $payload)) {
                return $payload[$key];
            }
        }

        return null;
    }

    private function extractLength(array $details): ?float
    {
        foreach (['length', 'Length', 'duration', 'Duration', 'duration_seconds'] as $key) {
            if (isset($details[$key]) && is_numeric($details[$key])) {
                return (float) $details[$key];
            }
        }

        return null;
    }

    private function isReadyStatus(int $status): bool
    {
        return in_array($status, self::READY_STATUSES, true);
    }
}
